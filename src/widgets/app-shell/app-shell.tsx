import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { signOut } from '@/entities/session';
import { ChangePasswordForm } from '@/features/change-password';
import { Modal } from '@/shared/ui';

const MENU = [
  { to: '/', label: '지도' },
  { to: '/calendar', label: '캘린더' },
  { to: '/records', label: '기록' },
];

export const AppShell = () => {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);
  const [changingPassword, setChangingPassword] = useState(false);

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
      <header className="flex items-center justify-between gap-4 border-b border-ink bg-paper px-4 py-3 sm:px-6 lg:px-10">
        <p className="wordmark">낚고먹고</p>
        <nav aria-label="주요 메뉴" className="main-nav">
          {MENU.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="button" onClick={() => setChangingPassword(true)}>
            비밀번호 변경
          </button>
          <button type="button" className="button" onClick={() => void signOut()}>
            로그아웃
          </button>
        </div>
      </header>
      <main id="main" ref={main} tabIndex={-1} className="flex-1 pb-20 outline-none lg:pb-0">
        <Suspense fallback={<p className="p-4 text-muted">불러오는 중입니다.</p>}>
          <Outlet />
        </Suspense>
      </main>
      {changingPassword && (
        <Modal title="비밀번호 변경" onClose={() => setChangingPassword(false)}>
          <ChangePasswordForm onDone={() => setChangingPassword(false)} />
        </Modal>
      )}
    </div>
  );
};
