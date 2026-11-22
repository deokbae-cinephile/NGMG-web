/*
 * auth-js 대신 쓰는 작은 로그인 클라이언트. 앱은 비밀번호 로그인과 세션 유지(토큰 갱신)만 씁니다.
 * 저장 키와 세션 모양은 supabase-js와 같아서 이미 로그인한 기기는 그대로 유지됩니다.
 */

export type Session = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  /** 초 단위 만료 시각 */
  expires_at: number;
  user: { id: string; email?: string };
};

type Listener = (event: string, session: Session | null) => void;
type AuthError = { status: number; code?: string; message: string };

/** 갱신 토큰이나 세션을 더는 쓸 수 없다는 오류 코드. 이때만 로그아웃하고, 다른 실패(설정·프록시·일시 오류)는 다시 시도합니다. */
const REVOKED = new Set(['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'invalid_grant', 'validation_failed']);

/** 계정에 딸린 서비스 워커 캐시. 앱 화면과 JS·CSS 캐시는 남깁니다. */
const clearPrivateCaches = () => {
  if (typeof caches === 'undefined') return;
  void caches
    .keys()
    .then((names) => Promise.all(names.filter((name) => /^ngmg-(data|photos)-/.test(name)).map((name) => caches.delete(name))))
    .catch(() => undefined);
};

/** 만료 1분 전부터 새 토큰을 받습니다. */
const REFRESH_MARGIN = 60;
const now = () => Math.floor(Date.now() / 1000);

export const createAuth = ({ url, key, storageKey }: { url: string; key: string; storageKey: string }) => {
  let current: Session | null = null;
  let refreshing: Promise<Session | null> | undefined;
  let timer: number | undefined;
  const listeners = new Set<Listener>();

  /** 저장된 세션. 저장소를 쓸 수 없으면 undefined, 저장 키가 없으면 null입니다. */
  const readStored = (): Session | null | undefined => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Session | null;
      return value?.access_token && value.refresh_token ? value : null;
    } catch {
      return undefined;
    }
  };
  const read = () => readStored() ?? null;
  const write = (session: Session | null) => {
    try {
      if (session) localStorage.setItem(storageKey, JSON.stringify(session));
      else localStorage.removeItem(storageKey);
    } catch {
      // 저장소를 못 쓰면 이 탭에서만 로그인이 유지됩니다.
    }
  };

  const schedule = () => {
    window.clearTimeout(timer);
    if (!current) return;
    const wait = Math.max(0, current.expires_at - REFRESH_MARGIN - now()) * 1000;
    timer = window.setTimeout(() => void refresh(), Math.min(wait, 2 ** 31 - 1));
  };

  const retryLater = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void refresh(), 30_000);
  };

  const set = (event: string, session: Session | null, store = true) => {
    // 로그아웃하거나 다른 계정이 되면 앞 계정의 오프라인 캐시(DB 응답·사진, public/sw.js)를 지웁니다.
    if (current && current.user.id !== session?.user.id) clearPrivateCaches();
    current = session;
    if (store) write(session);
    schedule();
    listeners.forEach((listener) => listener(event, session));
  };

  const request = async (path: string, body: object): Promise<{ session?: Session; error?: AuthError }> => {
    const response = await fetch(`${url}/auth/v1${path}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { error: { status: response.status, code: data.error_code ?? data.error, message: data.msg ?? data.error_description ?? data.message ?? '' } };
    return { session: { ...data, expires_at: data.expires_at ?? now() + data.expires_in } };
  };

  /** 갱신은 한 번에 하나만 보냅니다. 갱신 토큰이 무효면 로그아웃하고, 네트워크 오류면 세션을 두고 나중에 다시 시도합니다. */
  const refresh = () =>
    (refreshing ??= (async (): Promise<Session | null> => {
      try {
        // 다른 탭이 이미 갱신된 세션을 저장했으면 그것을 씁니다.
        const stored = read();
        if (stored && stored.expires_at - REFRESH_MARGIN > now()) {
          set('TOKEN_REFRESHED', stored, false);
          return stored;
        }
        
        // 현재 세션 확인 (로그아웃되었으면 중단)
        if (!current) {
          refreshing = undefined;
          return null;
        }
        
        const usedToken = current.refresh_token;
        const { session, error } = await request('/token?grant_type=refresh_token', { refresh_token: usedToken });
        
        // 요청 전까지 다른 탭이 세션을 바았거나 로그아웃되었는지 확인
        const latest = readStored();
        
        // 저장소를 읽을 수 없으면(undefined) 이 탭의 세션만 비교
        if (latest === undefined) {
          // current가 여전히 같은 토큰을 쓰고 있는지 확인
          if (current.refresh_token !== usedToken) {
            refreshing = undefined;
            return current; // 다른 탭이 이미 바换了
          }
        } else {
          // 저장소 상태 확인
          if (latest === null) {
            // 다른 탭이 로그아웃했으면 로그아웃
            set('SIGNED_OUT', null, false);
            refreshing = undefined;
            return null;
          }
          
          // 다른 탭이 토큰을 갱신했으면 그걸 씀
          if (latest.refresh_token !== usedToken) {
            set('TOKEN_REFRESHED', latest, false);
            refreshing = undefined;
            return latest;
          }
          
          // 현재 탭의 세션이 바였으면 중단
          if (current.refresh_token !== usedToken) {
            refreshing = undefined;
            return current;
          }
        }
        
        // 토큰 갱신 처리
        if (session) {
          set('TOKEN_REFRESHED', session);
        } else if (error && REVOKED.has(error.code ?? '')) {
          // 갱신 토큰이 무효면 로그아웃
          set('SIGNED_OUT', null);
        } else {
          // 네트워크 오류 등은 나중에 다시 시도
          retryLater();
        }
        
        refreshing = undefined;
        return read();
      } catch {
        retryLater(); // 오프라인
        refreshing = undefined;
        return current;
      }
    })());

  const ready = (async () => {
    current = read();
    if (current && current.expires_at - REFRESH_MARGIN <= now()) await refresh();
    else schedule();
  })();

  if (typeof window !== 'undefined') {
    // 다른 탭에서 로그인하거나 토큰을 바꾸면 따라갑니다.
    window.addEventListener('storage', (event) => {
      if (event.key === storageKey) set(read() ? 'TOKEN_REFRESHED' : 'SIGNED_OUT', read(), false);
    });
    // 잠자기에서 깨어나면 타이머가 늦을 수 있어 바로 확인합니다.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && current && current.expires_at - REFRESH_MARGIN <= now()) void refresh();
    });
  }

  return {
    /** 요청 직전에 부릅니다. 만료가 가까우면 새 토큰을 받은 뒤 돌려줍니다. */
    getSession: async () => {
      await ready;
      if (current && current.expires_at - REFRESH_MARGIN <= now()) await refresh();
      return { data: { session: current } };
    },
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      try {
        const { session, error } = await request('/token?grant_type=password', credentials);
        if (session) set('SIGNED_IN', session);
        return { error: error ?? null };
      } catch {
        return { error: { status: 0, message: 'network' } };
      }
    },
    /** 지금 세션을 먼저 한 번 알리고, 바뀔 때마다 알립니다. */
    onAuthStateChange: (listener: Listener) => {
      listeners.add(listener);
      void ready.then(() => listeners.has(listener) && listener('INITIAL_SESSION', current));
      return { data: { subscription: { unsubscribe: () => void listeners.delete(listener) } } };
    },
  };
};
