import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { InstallButton } from '@/features/install-app';
import { NavLink, useLocation } from '@/shared/lib';
import { Icon, Logo, PageSkeleton, type IconName } from '@/shared/ui';

const MENU: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '지도', icon: 'pin' },
  { to: '/schedule', label: '일정', icon: 'calendar' },
  { to: '/records', label: '기록', icon: 'notebook' },
  { to: '/stats', label: '통계', icon: 'stats' },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);

  // 화면이 바뀌면 스크린리더와 키보드 사용자를 본문으로 옮깁니다.
  useEffect(() => {
    if (first.current) first.current = false;
    else {
      // 화면이 바뀌면 맨 위부터 보여 줍니다. 초점을 옮기면서 브라우저가 스크롤을 움직이지 않게 합니다.
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    }
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        본문 바로가기
      </a>
      <header className="topbar">
        <NavLink to="/" className="topbar-logo">
          <Logo />
        </NavLink>
        <nav aria-label="주요 메뉴" className="main-nav">
          {MENU.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link" title={item.label}>
              <Icon name={item.icon} size={22} className="nav-icon" />
              <span className="nav-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {/* 설치는 메뉴(GNB)가 아니라 따로 두는 동작이라 메뉴 밖, 머리글 맨 오른쪽에 둡니다. */}
        <InstallButton />
      </header>
      <main id="main" ref={main} tabIndex={-1} className="flex-1 pb-16 outline-none lg:pb-0">
        <Suspense fallback={<PageSkeleton />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
};
