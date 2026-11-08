import type { Page, Route } from '@playwright/test';
import { createFakeServer, KAKAO_SDK, session, type FakeResponse, type Seed } from './fake-server.ts';

export type { Seed } from './fake-server.ts';

// 실제 서버 없이 프로덕션 빌드를 검사하려고 Supabase와 Kakao SDK, Open-Meteo 응답을 흉내 냅니다.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const fulfill = (route: Route, { status, contentType, body }: FakeResponse) => route.fulfill({ status, contentType, headers: CORS, body });
const json = (route: Route, body: unknown) => fulfill(route, { status: 200, contentType: 'application/json', body: JSON.stringify(body) });

export const startFakeBackend = async (page: Page, seed: Seed = {}, { signedIn = true, intro = false } = {}) => {
  const server = createFakeServer(seed);

  await page.route('https://dapi.kakao.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: KAKAO_SDK }));
  await page.route('https://api.open-meteo.com/**', (route) =>
    json(route, { daily: { weather_code: [1], temperature_2m_max: [18], temperature_2m_min: [11], precipitation_probability_max: [10], wind_speed_10m_max: [4.2] } }),
  );
  await page.route('https://marine-api.open-meteo.com/**', (route) => json(route, { daily: { wave_height_max: [0.5] } }));

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
