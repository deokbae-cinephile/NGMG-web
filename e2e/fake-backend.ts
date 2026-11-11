import type { Page, Route } from '@playwright/test';
import { createFakeServer, KAKAO_SDK, session, type FakeResponse, type Seed } from './fake-server.ts';

export type { Seed } from './fake-server.ts';

// 실제 서버 없이 프로덕션 빌드를 검사하려고 Supabase와 Kakao SDK, Open-Meteo 응답을 흉내 냅니다.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const fulfill = (route: Route, { status, contentType, body }: FakeResponse) => route.fulfill({ status, contentType, headers: CORS, body });

export const startFakeBackend = async (page: Page, seed: Seed = {}, { signedIn = true, intro = false } = {}) => {
  const server = createFakeServer(seed);

  await page.route('https://dapi.kakao.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: KAKAO_SDK }));
  // 지도 날씨(Open-Meteo): 구름 조금. 기온은 위도마다 달라 장소별로 따로 받는지 볼 수 있습니다(위도 34.03 → 14.3도).
  // 좌표를 쉼표로 여러 개 보내면 실제 API처럼 목록으로 돌려줍니다.
  await page.route('https://api.open-meteo.com/**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const latitudes = (params.get('latitude') ?? '').split(',').map(Number);
    const body = latitudes.map((latitude) => ({ current: { temperature_2m: Math.round((14.3 + (latitude - 34.03) * 2) * 10) / 10, weather_code: 2 } }));
    return route.fulfill({ contentType: 'application/json', headers: CORS, body: JSON.stringify(body.length === 1 ? body[0] : body) });
  });
  await page.route('**/fake-supabase/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split('/fake-supabase')[1] ?? '';
    let body = null;
    try {
      body = request.postDataJSON();
    } catch {
      // 사진 파일 같은 JSON이 아닌 본문
    }
    return fulfill(route, server.handle(path, { method: request.method(), url: request.url(), accept: request.headers().accept ?? '', body }));
  });

  // 인트로는 탭마다 한 번만 재생됩니다. 인트로를 검사할 때가 아니면 본 것으로 둡니다.
  if (!intro) await page.addInitScript(() => sessionStorage.setItem('ngmg:intro', '1'));

  if (signedIn) {
    await page.addInitScript((value) => {
      localStorage.setItem('sb-localhost-auth-token', JSON.stringify(value));
    }, session());
  }
  return server;
};
