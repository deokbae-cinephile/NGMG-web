import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { StorageClient } from '@supabase/storage-js';

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('.env에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요.');

/*
 * supabase-js 대신 쓰는 기능(로그인, DB, 사진)의 클라이언트만 묶습니다.
 * 실시간(realtime)·함수(functions)를 빼 첫 화면에 받는 코드를 줄였습니다. 동작은 supabase-js의 createClient와 같습니다.
 */
const auth = new AuthClient({
  url: `${url}/auth/v1`,
  headers: { apikey: key, Authorization: `Bearer ${key}` },
  // supabase-js와 같은 저장 키를 써서 이미 로그인한 기기는 그대로 유지됩니다.
  storageKey: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
});

/** 요청마다 로그인 토큰(없으면 공개 키)을 붙입니다. */
const authedFetch: typeof fetch = async (input, init) => {
  const { data } = await auth.getSession();
  const headers = new Headers(init?.headers);
  if (!headers.has('apikey')) headers.set('apikey', key);
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${data.session?.access_token ?? key}`);
  return fetch(input, { ...init, headers });
};

const rest = new PostgrestClient(`${url}/rest/v1`, { fetch: authedFetch });

export const supabase = {
  auth,
  from: (table: string) => rest.from(table),
  storage: new StorageClient(`${url}/storage/v1`, {}, authedFetch),
};
export const PHOTO_BUCKET = 'record-photos';
