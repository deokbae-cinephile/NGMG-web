import { Suspense, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Icon, Loader, Logo, type IconName } from '@/shared/ui';

const MENU: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '지도', icon: 'map' },
  { to: '/schedule', label: '일정', icon: 'calendar' },
  { to: '/records', label: '기록', icon: 'records' },
  { to: '/stats', label: '통계', icon: 'stats' },
];

export const AppShell = () => {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);

  // 화면이 바뀌면 스크린리더와 키보드 사용자를 본문으로 옮깁니다.
  useEffect(() => {
    if (first.current) first.current = false;
    else main.current?.focus();
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
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
              <Icon name={item.icon} size={22} className="nav-icon" />
              <span className="nav-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div aria-hidden="true" className="topbar-end ml-auto lg:ml-0" />
      </header>
      <main id="main" ref={main} tabIndex={-1} className="flex-1 pb-16 outline-none lg:pb-0">
        <Suspense fallback={<Loader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
};
