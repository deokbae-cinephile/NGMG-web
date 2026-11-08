import { useEffect, useMemo, useSyncExternalStore, type ComponentProps, type MouseEvent } from 'react';

/*
 * 화면 몇 개만 오가는 작은 라우터. History API로 주소를 바꾸고 바뀐 주소를 구독합니다.
 * 라우터 라이브러리 대신 써서 첫 화면에 받는 코드를 줄였습니다.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  if (!listeners.size) window.addEventListener('popstate', notify);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('popstate', notify);
  };
};
const snapshot = () => location.pathname + location.search;

export const navigate = (to: string, { replace = false } = {}) => {
  history[replace ? 'replaceState' : 'pushState'](null, '', BASE + to);
  notify();
};

export const useLocation = () => {
  const current = useSyncExternalStore(subscribe, snapshot, () => '/');
  const [path = '/', query = ''] = current.split('?');
  return { pathname: path.slice(BASE.length) || '/', search: query ? `?${query}` : '' };
};

/** 주소의 ?key=value를 읽고 바꿉니다. 바꿀 때는 지금 화면 주소에 붙입니다. */
export const useSearchParams = () => {
  const { pathname, search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const setParams = (next: Record<string, string>, options?: { replace?: boolean }) =>
    navigate(`${pathname}?${new URLSearchParams(next)}`, options);
  return [params, setParams] as const;
};

/** 렌더되면 다른 주소로 넘깁니다. (예전 주소 넘기기) */
export const Navigate = ({ to }: { to: string }) => {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
};

type LinkProps = Omit<ComponentProps<'a'>, 'href'> & { to: string };

/** 새 탭 열기(Ctrl·Cmd·가운데 클릭)는 브라우저에 맡기고, 그냥 누르면 페이지를 다시 받지 않고 화면만 바꿉니다. */
export const Link = ({ to, onClick, children, ...props }: LinkProps) => {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target) return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={BASE + to} onClick={handle} {...props}>
      {children}
    </a>
  );
};

/** 지금 화면이면 aria-current="page"를 붙입니다. end면 주소가 정확히 같을 때만, 아니면 하위 주소까지 지금 화면으로 봅니다. */
export const NavLink = ({ end = false, ...props }: LinkProps & { end?: boolean }) => {
  const { pathname } = useLocation();
  const active = pathname === props.to || (!end && pathname.startsWith(`${props.to.replace(/\/$/, '')}/`));
  return <Link aria-current={active ? 'page' : undefined} {...props} />;
};
