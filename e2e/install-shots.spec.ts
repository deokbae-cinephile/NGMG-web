import { test } from '@playwright/test';
import { demoSeed } from './demo-data';
import { startFakeBackend as fakeBackend } from './fake-backend';

// 앱 설치 화면에 보이는 미리보기(public/screenshots)를 만듭니다. 화면의 장소와 기록은 모두 가상 데이터입니다. pnpm run shots로 실행합니다.
test.skip(!process.env.SHOTS, '설치 미리보기를 만들 때만 실행합니다.');

const seed = () => demoSeed(new Date(2026, 10, 14));

const dir = 'public/screenshots';

test('휴대폰 화면', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await fakeBackend(page, seed());
  await page.goto('./schedule?date=2026-11-14');
  await page.getByRole('heading', { name: '새벽 출조' }).waitFor();
  await page.screenshot({ path: `${dir}/narrow.jpg`, type: 'jpeg', quality: 80 });
});

test('넓은 화면', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await fakeBackend(page, seed());
  await page.goto('./');
  await page.getByText('밤바다 횟집').first().waitFor();
  await page.screenshot({ path: `${dir}/wide.jpg`, type: 'jpeg', quality: 80 });
});
