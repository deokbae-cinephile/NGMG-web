import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { useSession } from '@/entities/session';
import { LoginPage } from '@/pages/login';
import { ErrorBoundary } from '@/shared/ui';
import { AppShell } from '@/widgets/app-shell';

const MapPage = lazy(() => import('@/pages/map').then((page) => ({ default: page.MapPage })));
const CalendarPage = lazy(() => import('@/pages/calendar').then((page) => ({ default: page.CalendarPage })));
const RecordsPage = lazy(() => import('@/pages/records').then((page) => ({ default: page.RecordsPage })));
const PlacePage = lazy(() => import('@/pages/place').then((page) => ({ default: page.PlacePage })));

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

const Loading = () => <p className="p-4 text-muted">불러오는 중입니다.</p>;

const NotFound = () => (
  <div className="p-4">
    <title>페이지 없음 | 낚고먹고</title>
    <h1 className="page-title">페이지를 찾을 수 없습니다</h1>
  </div>
);

export const App = () => {
  const session = useSession();

  useEffect(() => {
    if (session === null) client.clear(); // 로그아웃하면 화면에 남은 데이터를 지웁니다.
  }, [session]);

  if (session === undefined) return <Loading />;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        {session === null ? (
          <LoginPage />
        ) : (
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<MapPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="records" element={<RecordsPage />} />
                <Route path="places/:id" element={<PlacePage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
