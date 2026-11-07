import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { useSession } from '@/entities/session';
import { LoginPage } from '@/pages/login';
import { ErrorBoundary, Loader } from '@/shared/ui';
import { AppShell } from '@/widgets/app-shell';

const MapPage = lazy(() => import('@/pages/map').then((page) => ({ default: page.MapPage })));
const SchedulePage = lazy(() => import('@/pages/schedule').then((page) => ({ default: page.SchedulePage })));
const RecordsPage = lazy(() => import('@/pages/records').then((page) => ({ default: page.RecordsPage })));
const StatsPage = lazy(() => import('@/pages/stats').then((page) => ({ default: page.StatsPage })));
const PlacePage = lazy(() => import('@/pages/place').then((page) => ({ default: page.PlacePage })));

/** 예전 주소(/calendar?date=...)로 들어와도 고른 날짜를 그대로 이어 갑니다. */
const CalendarRedirect = () => <Navigate to={{ pathname: '/schedule', search: useLocation().search }} replace />;

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

const NotFound = () => (
  <div className="cell-body">
    <title>페이지 없음 | 낚고먹고</title>
    <h1 className="title text-2xl">페이지를 찾을 수 없습니다</h1>
  </div>
);

/** 첫 화면의 글꼴 조각을 다 받을 때까지 로딩을 덮어 글자가 바뀌며 흔들리지 않게 합니다. 오래 걸려도 3초 뒤에는 엽니다. */
const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const done = () => setReady(true);
    const timer = window.setTimeout(done, 3000);
    // 첫 화면을 그린 뒤 그 화면이 요청한 글꼴을 기다립니다.
    requestAnimationFrame(() => void document.fonts.ready.then(done));
    return () => window.clearTimeout(timer);
  }, []);
  return ready;
};

export const App = () => {
  const session = useSession();
  const fontsReady = useFontsReady();

  useEffect(() => {
    if (session === null) client.clear(); // 로그아웃되면 화면에 남은 데이터를 지웁니다.
  }, [session]);

  return (
    <ErrorBoundary>
      {(session === undefined || !fontsReady) && <Loader fullscreen />}
      {session !== undefined && (
        <QueryClientProvider client={client}>
          {session === null ? (
            <LoginPage />
          ) : (
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<MapPage />} />
                  <Route path="schedule" element={<SchedulePage />} />
                  <Route path="calendar" element={<CalendarRedirect />} />
                  <Route path="records" element={<RecordsPage />} />
                  <Route path="stats" element={<StatsPage />} />
                  <Route path="places/:id" element={<PlacePage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          )}
        </QueryClientProvider>
      )}
    </ErrorBoundary>
  );
};
