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
  await page.goto('./schedule?date=2026-11-14');
  await page.getByRole('heading', { name: '새벽 출조' }).waitFor();
  await page.screenshot({ path: `${dir}/schedule-mobile.jpg`, type: 'jpeg', quality: 80 });
  await page.goto('./stats');
  await page.getByRole('heading', { level: 2 }).first().waitFor();
  await page.screenshot({ path: `${dir}/stats.jpg`, type: 'jpeg', quality: 80 });
  await page.goto('./dex');
  await page.getByRole('heading', { name: '어종 도감', level: 2 }).waitFor();
  await page.getByRole('heading', { level: 3 }).first().waitFor();
  await page.screenshot({ path: `${dir}/dex.jpg`, type: 'jpeg', quality: 80 });
  await page.goto('./gear');
  await page.getByRole('heading', { name: '김 조사 장비' }).waitFor();
  await page.getByRole('heading', { name: /닉스 인쇼어/ }).first().waitFor();
  await page.screenshot({ path: `${dir}/gear.jpg`, type: 'jpeg', quality: 80 });
  await page.getByRole('button', { name: '김 조사 장비 추가' }).click();
  await page.getByRole('dialog').getByLabel('분류', { exact: true }).selectOption('라인');
  await page.getByRole('dialog').getByLabel('브랜드').fill('선라인');
  await page.getByRole('dialog').getByLabel('장비 이름').fill('베이직 FC 카본 3호');
  await page.screenshot({ path: `${dir}/gear-form.jpg`, type: 'jpeg', quality: 80 });
});

test('넓은 화면', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await fakeBackend(page, seed());
  await page.goto('./');
  await page.getByText('밤바다 횟집').first().waitFor();
  await page.screenshot({ path: `${dir}/map.jpg`, type: 'jpeg', quality: 80 });
  await page.goto('./schedule?date=2026-11-14');
  await page.getByRole('heading', { name: '새벽 출조' }).waitFor();
  await page.getByRole('region', { name: /물때와 날씨/ }).waitFor();
  await page.getByRole('heading', { name: '전체 기록' }).waitFor();
  await page.screenshot({ path: `${dir}/schedule.jpg`, type: 'jpeg', quality: 80 });
});

test('로그인 화면', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await fakeBackend(page, {}, { signedIn: false });
  await page.goto('./');
  await page.getByRole('heading', { name: '낚고먹고' }).waitFor();
  await page.screenshot({ path: `${dir}/login.jpg`, type: 'jpeg', quality: 80 });
});
