import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, useCallback, useEffect, useState } from 'react';
import { useSession } from '@/entities/session';
import { preloadEventForm } from '@/features/event-form';
import { preloadGearForm } from '@/features/gear-form';
import { preloadPlaceForm } from '@/features/place-form';
import { preloadRecordForm } from '@/features/record-form';
import { LoginPage } from '@/pages/login';
import { Navigate, useLocation } from '@/shared/lib';
import { ErrorBoundary } from '@/shared/ui';
import { AppShell } from '@/widgets/app-shell';
import { Splash } from './splash';
import { placePath } from '@/shared/config';

const pages = {
  map: () => import('@/pages/map').then((page) => ({ default: page.MapPage })),
  schedule: () => import('@/pages/schedule').then((page) => ({ default: page.SchedulePage })),
  stats: () => import('@/pages/stats').then((page) => ({ default: page.StatsPage })),
  place: () => import('@/pages/place').then((page) => ({ default: page.PlacePage })),
  settings: () => import('@/pages/settings').then((page) => ({ default: page.SettingsPage })),
  dex: () => import('@/pages/dex').then((page) => ({ default: page.DexPage })),
  gear: () => import('@/pages/gear').then((page) => ({ default: page.GearPage })),
};
const MapPage = lazy(pages.map);
const SchedulePage = lazy(pages.schedule);
const StatsPage = lazy(pages.stats);
const PlacePage = lazy(pages.place);
const SettingsPage = lazy(pages.settings);
const DexPage = lazy(pages.dex);
const GearPage = lazy(pages.gear);

// 조회는 offlineFirst: 오프라인이어도 한 번은 요청해 서비스 워커(public/sw.js)에 저장된 마지막 응답을 받습니다.
// 오프라인에서 저장된 응답도 없으면 재시도를 연결이 돌아올 때까지 미뤄 로딩에 머무르므로, 오프라인이면 다시 시도하지 않고 오류로 끝냅니다.
// 저장은 always: 오프라인에서 저장을 멈춰 두면 저장 중 화면이 잠기므로, 바로 보내 실패를 알립니다.
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: (count) => navigator.onLine && count < 1, staleTime: 30_000, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'always' },
  },
});

const NotFound = () => (
  <div className="cell-body">
    <title>페이지 없음 | 낚고먹고</title>
    <h1 className="title text-2xl">페이지를 찾을 수 없습니다</h1>
  </div>
);

/** 주소에 맞는 화면. 예전 주소(/calendar?date=..., /records)로 들어와도 고른 날짜를 그대로 이어 갑니다. */
const Page = () => {
  const { pathname, search } = useLocation();
  if (pathname === '/') return <MapPage />;
  if (pathname === '/schedule') return <SchedulePage />;
  if (pathname === '/calendar') return <Navigate to={`/schedule${search}`} />;
  if (pathname === '/records') return <Navigate to={`/schedule${search}`} />;
  if (pathname === '/stats') return <StatsPage />;
  if (pathname === '/settings') return <SettingsPage />;
  if (pathname === '/items') return <GearPage />;
  if (pathname === '/gear') return <Navigate to="/items" />; // 예전 주소
  if (pathname === '/dex') return <DexPage />;
  if (pathname === '/place') {
    const id = new URLSearchParams(search).get('id');
    return id ? <PlacePage id={id} /> : <NotFound />;
  }
  const legacyPlace = /^\/places\/([^/]+)$/.exec(pathname); // 예전 주소
  if (legacyPlace) return <Navigate to={placePath(decodeURIComponent(legacyPlace[1]!))} />;
  return <NotFound />;
};

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
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // 로그인 후 다른 메뉴의 코드를 미리 받아 둡니다. 메뉴를 처음 눌러도 로딩 화면 없이 바로 바뀝니다.
  useEffect(() => {
    if (!session) return;
    // 폼 코드(장소·기록·일정)도 함께 받아 두어, 오프라인에서도 창이 열립니다.
    const timer = window.setTimeout(() => {
      Object.values(pages).forEach((load) => void load());
      [preloadPlaceForm, preloadRecordForm, preloadEventForm, preloadGearForm].forEach((preload) => preload());
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [session]);

  const userId = session?.user.id;
  useEffect(() => {
    if (session === null) client.clear(); // 로그아웃되면 화면에 남은 데이터를 지웁니다.
    else client.removeQueries({ queryKey: ['session', 'role'] }); // 다른 계정(예: 게스트)으로 들어오면 역할을 다시 읽습니다.
  }, [session, userId]);

  return (
    <ErrorBoundary>
      {!splashDone && <Splash ready={session !== undefined && fontsReady} onDone={finishSplash} />}
      {session !== undefined && (
        <div className="contents" inert={!splashDone}>
        <QueryClientProvider client={client}>
          {session === null ? (
            <LoginPage />
          ) : (
            <AppShell>
              <Page />
            </AppShell>
          )}
        </QueryClientProvider>
        </div>
      )}
    </ErrorBoundary>
  );
};
