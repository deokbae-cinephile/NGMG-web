// 배포용 데모(pnpm run build:demo)에서 앱보다 먼저 실행됩니다. 앱 코드는 바꾸지 않고 브라우저 안에서 서버 응답을 흉내 냅니다.
import { demoSeed } from './demo-data.ts';
import { createFakeServer, KAKAO_SDK, session, type Seed } from './fake-server.ts';

declare global {
  var __DEMO_API__: string;
}

const API = `${location.origin}${import.meta.env.BASE_URL}demo-api`;
globalThis.__DEMO_API__ = API; // vite.config.ts가 VITE_SUPABASE_URL을 이 값으로 바꿉니다.

// 고친 데이터는 탭을 닫기 전까지 유지합니다.
const STORE = 'ngmg-demo-db';
const load = (): Seed | undefined => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? 'null') ?? undefined;
  } catch {
    return undefined;
  }
};
const server = createFakeServer(load() ?? demoSeed(new Date()));
const save = () => {
  try {
    const { places, records, record_photos, fish_catches, menu_items, gear_sets, gear_set_items, angler_gear, events, checklist_items } = server;
    sessionStorage.setItem(STORE, JSON.stringify({ places, records, record_photos, fish_catches, menu_items, gear_sets, gear_set_items, angler_gear, events, checklist_items }));
  } catch {
    // 저장소를 못 쓰면 새로고침할 때 처음 데이터로 돌아갑니다.
  }
};

const parse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null; // 사진 파일 같은 JSON이 아닌 본문
  }
};

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const request = new Request(input, init);
  if (!request.url.startsWith(API)) return realFetch(input, init);
  const path = new URL(request.url).pathname.slice(new URL(API).pathname.length);
  const body = ['GET', 'HEAD'].includes(request.method) ? null : parse(await request.text());
  const response = server.handle(path, { method: request.method, url: request.url, accept: request.headers.get('accept') ?? '', body });
  if (request.method !== 'GET') save();
  // 사진은 <img>가 직접 받으므로 정적 파일(demo-photo.svg)을 가리키게 합니다. SDK가 앞에 '<API>/storage/v1'을 붙입니다.
  const text = path.startsWith('/storage/v1/object/sign/')
    ? response.body.replace(/\/object\/fake-photo\/[^"]*/g, '/../../../demo-photo.svg')
    : response.body;
  return new Response(text, { status: response.status, headers: { 'content-type': response.contentType } });
};

// Kakao SDK 대신 가짜 지도를 불러옵니다.
const sdk = URL.createObjectURL(new Blob([KAKAO_SDK], { type: 'text/javascript' }));
const src = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')!;
Object.defineProperty(HTMLScriptElement.prototype, 'src', {
  ...src,
  set(value: string) {
    src.set!.call(this, String(value).startsWith('https://dapi.kakao.com/') ? sdk : value);
  },
});

// 로그인한 상태로 시작합니다. 로그아웃하면 아무 이메일과 비밀번호로 다시 들어올 수 있습니다.
try {
  const key = `sb-${location.hostname.split('.')[0]}-auth-token`;
  if (!sessionStorage.getItem(`${STORE}-started`)) localStorage.setItem(key, JSON.stringify(session()));
  sessionStorage.setItem(`${STORE}-started`, '1');
} catch {
  // 저장소를 못 쓰면 로그인 화면부터 보입니다.
}
