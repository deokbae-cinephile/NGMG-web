import { Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { InstallButton } from '@/features/install-app';
import { ScrollTopButton } from '@/features/scroll-top';
import { ThemeToggle } from '@/features/theme-toggle';
import { NavLink, useLocation } from '@/shared/lib';
import { Icon, Logo, PageSkeleton, type IconName, type PageVariant } from '@/shared/ui';
import { PendingRatings } from './pending-ratings';
import { SaveOutbox } from './save-outbox';

const MENU: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '지도', icon: 'pin' },
  { to: '/schedule', label: '일정 및 기록', icon: 'calendar' },
  { to: '/stats', label: '통계', icon: 'stats' },
  { to: '/dex', label: '도감', icon: 'dex' },
  { to: '/gear', label: '장비', icon: 'rod' },
];

/** 화면 코드를 받는 동안 그 화면 모양의 자리를 보여 줍니다. */
const skeletonFor = (pathname: string): PageVariant => {
  if (pathname === '/') return 'map';
  if (pathname === '/schedule') return 'schedule';
  if (pathname === '/stats') return 'stats';
  if (pathname === '/dex') return 'dex';
  if (pathname === '/gear') return 'gear';
  if (pathname.startsWith('/places/')) return 'place';
  return 'default';
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);

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
        <ThemeToggle />
        <nav aria-label="주요 메뉴" className="main-nav">
          {MENU.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link" title={item.label}>
              <Icon name={item.icon} size={22} className="nav-icon" />
              <span className="nav-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" ref={main} tabIndex={-1} className="main-area min-h-0 flex-1 outline-none lg:overflow-y-auto">
        <Suspense fallback={<PageSkeleton variant={skeletonFor(pathname)} />}>
          {children}
        </Suspense>
      </main>
      {/* 설치와 맨 위로는 메뉴(GNB)와 다른 동작이라 메뉴 밖 오른쪽 아래에 따로 띄웁니다. */}
      <div className="floating-actions">
        <SaveOutbox />
        <PendingRatings />
        <InstallButton />
        <ScrollTopButton />
      </div>
    </div>
  );
};
