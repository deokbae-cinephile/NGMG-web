import { Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { usePendingRatings } from '@/entities/record';
import { useRole } from '@/entities/session';
import { ScrollTopButton } from '@/features/scroll-top';
import { NavLink, useLocation } from '@/shared/lib';
import { Icon, Logo, PageSkeleton, type IconName, type PageVariant } from '@/shared/ui';
import { SaveOutbox } from './save-outbox';

const MENU: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '지도', icon: 'pin' },
  { to: '/schedule', label: '일정 및 기록', icon: 'calendar' },
  { to: '/stats', label: '통계', icon: 'stats' },
  { to: '/dex', label: '도감', icon: 'dex' },
  { to: '/items', label: '물품', icon: 'tackleBox' },
  { to: '/settings', label: '설정', icon: 'settings' },
];

/** 화면 코드를 받는 동안 그 화면 모양의 자리를 보여 줍니다. */
const skeletonFor = (pathname: string): PageVariant => {
  if (pathname === '/') return 'map';
  if (pathname === '/schedule') return 'schedule';
  if (pathname === '/stats') return 'stats';
  if (pathname === '/dex') return 'dex';
  if (pathname === '/place' || pathname.startsWith('/places/')) return 'place';
  if (pathname === '/settings') return 'settings';
  return 'default';
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);
  const pending = usePendingRatings().data?.length ?? 0;
  const { role, error: roleError } = useRole();

  // 화면이 바뀌면 맨 위부터 보여 줍니다. 그리기 전에 옮기고, 새 화면이 그려진 다음에도 한 번 더 옮깁니다.
  useLayoutEffect(() => {
    if (first.current) return;
    // 휴대폰은 문서가, 넓은 화면은 본문 영역이 스크롤됩니다.
    const toTop = () => {
      window.scrollTo(0, 0);
      main.current?.scrollTo(0, 0);
    };
    toTop();
    const frame = requestAnimationFrame(toTop);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  // 스크린리더와 키보드 사용자를 본문으로 옮깁니다.
  useEffect(() => {
    if (first.current) first.current = false;
    else main.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <a href="#main" className="skip-link">
        본문 바로가기
      </a>
      <header className="topbar">
        <NavLink to="/" className="topbar-logo">
          <Logo />
        </NavLink>
        <nav aria-label="주요 메뉴" className="main-nav">
          {MENU.map((item) => {
            // 평점 대기가 있으면 설정 메뉴에 건수를 붙입니다. 읽는 이름에도 넣어 색만으로 알리지 않습니다.
            const badge = item.to === '/settings' && pending ? pending : 0;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link" title={item.label}>
                <span className="relative">
                  <Icon name={item.icon} size={22} className="nav-icon" />
                  {badge > 0 && <span aria-hidden="true" className="nav-badge">{badge > 9 ? '9+' : badge}</span>}
                </span>
                <span className="nav-text">{item.label}</span>
                {badge > 0 && <span className="sr-only">{`, 평점 대기 ${badge}건`}</span>}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main id="main" ref={main} tabIndex={-1} className="main-area min-h-0 flex-1 outline-none lg:overflow-y-auto">
        {role === 'guest' && <p className="guest-banner">게스트로 보는 중입니다. 보기만 할 수 있습니다.</p>}
        {roleError && <p className="guest-banner">계정 권한을 확인하지 못해 추가·수정 버튼을 감췄습니다. 새로고침해 주세요.</p>}
        <Suspense fallback={<PageSkeleton variant={skeletonFor(pathname)} />}>
          {children}
        </Suspense>
      </main>
      {/* 저장 대기와 맨 위로는 메뉴(GNB)와 다른 동작이라 메뉴 밖 오른쪽 아래에 따로 띄웁니다. 평점 대기·앱 설치는 설정에 있습니다. */}
      <div className="floating-actions">
        <SaveOutbox />
        <ScrollTopButton />
      </div>
    </div>
  );
};
