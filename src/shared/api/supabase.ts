import { PostgrestClient } from '@supabase/postgrest-js';
import { createAuth } from './auth';

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('.env에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요.');

/*
 * supabase-js 대신 DB 클라이언트(postgrest-js)만 쓰고, 로그인(auth.ts)과 사진 저장소는 직접 요청합니다.
 * 실시간(realtime)·함수(functions)를 빼 첫 화면에 받는 코드를 줄였습니다.
 * supabase-js와 같은 저장 키를 써서 이미 로그인한 기기는 그대로 유지됩니다.
 */
const auth = createAuth({ url, key, storageKey: `sb-${new URL(url).hostname.split('.')[0]}-auth-token` });

/** 요청마다 로그인 토큰(없으면 공개 키)을 붙입니다. */
const authedFetch: typeof fetch = async (input, init) => {
  const { data } = await auth.getSession();
  const headers = new Headers(init?.headers);
  if (!headers.has('apikey')) headers.set('apikey', key);
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${data.session?.access_token ?? key}`);
  return fetch(input, { ...init, headers });
};

const rest = new PostgrestClient(`${url}/rest/v1`, { fetch: authedFetch });

type StorageResult<T> = { data: T | null; error: Error | null };

/** Storage REST 요청. 실패해도 던지지 않고 storage-js처럼 error로 돌려줍니다. */
const storageCall = async <T>(path: string, init: RequestInit): Promise<StorageResult<T>> => {
  try {
    const response = await authedFetch(`${url}/storage/v1${path}`, init);
    const body = await response.json().catch(() => null);
    if (response.ok) return { data: body as T, error: null };
    return { data: null, error: new Error(body?.message ?? body?.error ?? `사진 저장소 요청 실패 (${response.status})`) };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * storage-js 대신 쓰는 사진 저장소 클라이언트. 앱이 쓰는 서명 주소·올리기·지우기만 Storage REST로 직접 보냅니다.
 * storage-js(와 딸린 iceberg-js)를 빼서 첫 화면에 받는 코드를 줄였습니다. 쓰는 모양은 storage-js와 같습니다.
 */
const bucket = (id: string) => ({
  createSignedUrls: async (paths: string[], expiresIn: number) => {
    const result = await storageCall<{ path: string | null; signedURL: string | null; error: string | null }[]>(`/object/sign/${id}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ expiresIn, paths }),
    });
    // 서버는 Storage 주소 뒤에 붙일 상대 경로를 줍니다.
    return { ...result, data: result.data?.map((item) => ({ ...item, signedUrl: item.signedURL ? `${url}/storage/v1${item.signedURL}` : null })) ?? null };
  },
  upload: (path: string, file: Blob, { upsert = false, contentType }: { upsert?: boolean; contentType?: string } = {}) =>
    storageCall<{ Key: string }>(`/object/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType ?? (file.type || 'application/octet-stream'), 'cache-control': 'max-age=3600', 'x-upsert': String(upsert) },
      body: file,
    }),
  remove: (paths: string[]) => storageCall<unknown[]>(`/object/${id}`, { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ prefixes: paths }) }),
});

export const supabase = {
  auth,
  from: (table: string) => rest.from(table),
  storage: { from: bucket },
};
export const PHOTO_BUCKET = 'record-photos';
/** 비공개 사진의 서명 주소 유효 시간(24시간). 탭을 오래 열어 두어도 사진이 깨지지 않고, 탭으로 돌아오면 목록과 함께 새로 받습니다. */
export const SIGNED_URL_SECONDS = 86_400;
