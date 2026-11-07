import { test } from '@playwright/test';
import { demoSeed } from './demo-data';
import { startFakeBackend as fakeBackend } from './fake-backend';

// README 스크린샷을 만듭니다. 화면의 장소와 기록은 모두 가상 데이터입니다. pnpm run shots로 실행합니다.
test.skip(!process.env.SHOTS, 'README 스크린샷을 만들 때만 실행합니다.');

const seed = () => demoSeed(new Date(2026, 10, 14));

const dir = 'docs/images';

test('휴대폰 화면', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await fakeBackend(page, seed());
  await page.goto('./calendar?date=2026-11-14');
  await page.getByRole('heading', { name: '새벽 출조' }).waitFor();
  await page.screenshot({ path: `${dir}/calendar-mobile.jpg`, type: 'jpeg', quality: 80 });
  await page.getByRole('button', { name: '일정 추가' }).click();
  await page.getByRole('dialog').getByLabel('할 일').fill('저녁 낚시');
  await page.screenshot({ path: `${dir}/event-form.jpg`, type: 'jpeg', quality: 80 });
  await page.goto('./records');
  await page.getByText('감성돔 1마리').waitFor();
  await page.screenshot({ path: `${dir}/records.jpg`, type: 'jpeg', quality: 80 });
});

test('넓은 화면', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await fakeBackend(page, seed());
  await page.goto('./calendar?date=2026-11-14');
  await page.getByRole('heading', { name: '새벽 출조' }).waitFor();
  await page.getByRole('region', { name: /물때와 날씨/ }).waitFor();
  await page.screenshot({ path: `${dir}/calendar.jpg`, type: 'jpeg', quality: 80, fullPage: true });
});

test('로그인 화면', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await fakeBackend(page, {}, { signedIn: false });
  await page.goto('./');
  await page.getByRole('heading', { name: '낚고먹고' }).waitFor();
  await page.screenshot({ path: `${dir}/login.jpg`, type: 'jpeg', quality: 80 });
});
