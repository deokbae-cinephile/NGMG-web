// 서버와 키 없이 앱을 직접 써 보는 데모입니다. 데이터는 창을 닫으면 사라집니다. pnpm run demo로 실행합니다.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { demoSeed } from './demo-data.ts';
import { startFakeBackend } from './fake-backend.ts';

const PORT = 5199;
const url = `http://localhost:${PORT}/`;

const server = spawn('node_modules/.bin/vite', ['--port', String(PORT), '--strictPort'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_SUPABASE_URL: `http://localhost:${PORT}/fake-supabase`,
    VITE_SUPABASE_ANON_KEY: 'demo',
    VITE_KAKAO_MAP_KEY: 'demo',
  },
});
const stop = () => server.kill();
process.on('SIGINT', () => process.exit());
process.on('exit', stop);

for (let tries = 0; ; tries += 1) {
  const up = await fetch(url).then(() => true, () => false);
  if (up) break;
  if (tries > 100) throw new Error('개발 서버가 시작되지 않았습니다.');
  await new Promise((resolve) => setTimeout(resolve, 200));
}

const headless = Boolean(process.env.DEMO_CHECK);
const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: null });
await startFakeBackend(page, demoSeed(new Date()));
page.on('pageerror', (error) => console.error('화면 오류:', error.message));
await page.goto(url);
console.log(`\n데모 실행 중: 열린 창을 닫으면 끝납니다.\n`);

if (headless) {
  // 개발 모드(StrictMode)에서 대화상자가 열린 채 유지되는지까지 확인합니다.
  await page.getByRole('heading', { name: '내 장소' }).waitFor();
  await page.goto(`${url}calendar`);
  await page.getByRole('button', { name: '일정 추가' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('dialog', { name: '새 일정' }).waitFor();
  console.log('DEMO_CHECK 통과');
  await browser.close();
} else {
  await new Promise((resolve) => browser.on('disconnected', resolve));
}
process.exit();
