import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { startFakeBackend as fakeBackend, type Seed } from './fake-backend';

const LONG_NAME = '아주아주긴이름의낚시포인트'.repeat(8);

const place = (id: string, name: string, kind = 'fishing') => ({
  id, name, kind, address: '전남 여수시 삼산면', latitude: 34.03, longitude: 127.3, memo: '',
});

const seed = (): Seed => ({
  places: [place('p1', '거문도 방파제'), place('p2', '바다횟집', 'restaurant'), place('p3', LONG_NAME)],
  events: [{ id: 'e1', date: '2026-11-07', start_time: '06:00:00', end_time: '09:00:00', title: '새벽 출조', place_id: 'p1', memo: '' }],
  checklist_items: [],
  records: Array.from({ length: 25 }, (_, index) => ({
    id: `r${String(index).padStart(2, '0')}`,
    place_id: 'p1',
    visited_on: `2026-10-${String(30 - index).padStart(2, '0')}`,
    catches: `감성돔 ${index + 1}마리`,
    memo: '',
    rating: 4,
  })),
  record_photos: [{ id: 'ph1', record_id: 'r00', storage_path: 'r00/1.jpg', position: 0 }],
});

const expectFits = async (page: Page) => {
  // 문서 가로 스크롤과 함께, 잘려서 스크롤이 안 생기는 경우도 잡도록 본문 요소의 오른쪽 끝을 봅니다.
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const right = Math.max(...[...document.querySelectorAll('main *')].map((el) => el.getBoundingClientRect().right));
    return Math.max(document.documentElement.scrollWidth - width, right - width);
  });
  expect(overflow).toBeLessThanOrEqual(0.5);
};

const expectAccessible = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((item) => `${item.id}: ${item.nodes.map((node) => node.target).join(' | ')}`)).toEqual([]);
};

test.beforeEach(({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
});

test('로그인 화면: 틀리면 안내하고 맞으면 들어간다', async ({ page }) => {
  await fakeBackend(page, seed(), { signedIn: false });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '낚고먹고' })).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);

  await page.getByLabel('이메일').fill('a@example.com');
  await page.getByLabel('비밀번호').fill('wrong');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('alert')).toContainText('비밀번호를 확인');

  await page.getByLabel('비밀번호').fill('right');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('heading', { name: '내 장소', exact: true })).toBeVisible();
});

test('지도: 검색으로 장소를 추가하고 필터를 기억한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./');
  await expect(page.getByRole('button', { name: '거문도 방파제 (낚시) 선택' })).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);

  await page.getByRole('button', { name: '장소 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 장소' });
  await dialog.getByRole('searchbox', { name: '장소 검색' }).fill('백도');
  await dialog.getByRole('button', { name: '검색' }).click();
  await dialog.getByRole('button', { name: /백도 횟집/ }).click();
  await expect(dialog.getByLabel('이름')).toHaveValue('백도 횟집');
  await expect(dialog.getByRole('radio', { name: '맛집' })).toBeChecked();
  await expectFits(page);
  await expectAccessible(page);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: /백도 횟집/ }).first()).toBeVisible();
  expect(db.places).toHaveLength(4);

  await page.getByLabel('이름·주소·태그로 찾기').fill('거문도');
  await expect(page.getByRole('status').last()).toHaveText('장소 1곳');
  await page.getByLabel('이름·주소·태그로 찾기').clear();

  await page.getByRole('button', { name: '맛집', exact: true }).click();
  await expect(page.getByRole('button', { name: '거문도 방파제 (낚시) 선택' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: '맛집', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('장소: 수정하고 삭제한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./places/p2');
  await expect(page.getByRole('heading', { name: '바다횟집', exact: true })).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);

  await page.getByRole('button', { name: '장소 수정' }).click();
  const dialog = page.getByRole('dialog', { name: '장소 수정' });
  await dialog.getByLabel('이름').fill('');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('이름을 입력해 주세요.')).toBeVisible();
  await dialog.getByLabel('이름').fill('푸른바다횟집');
  await dialog.getByLabel('위도').fill('999');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('-90에서 90 사이')).toBeVisible();
  await dialog.getByLabel('위도').fill('34.5');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: '푸른바다횟집', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '장소 삭제' }).click();
  await expect(page.getByRole('heading', { name: '내 장소', exact: true })).toBeVisible();
  expect(db.places!.map((item) => item.id)).not.toContain('p2');
});

test('장소: 긴 이름도 화면을 넘치지 않는다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  await expect(page.getByRole('button', { name: new RegExp(LONG_NAME) }).first()).toBeVisible();
  await expectFits(page);
  await page.goto('./places/p3');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectFits(page);
});

test('기록: 사진과 함께 저장한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  await dialog.getByLabel('조과').fill('볼락 3마리');
  await dialog.getByLabel('별점').selectOption('5');
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    return canvas.toDataURL('image/png');
  });
  const png = Buffer.from(dataUrl.split(',')[1]!, 'base64');
  await dialog.getByLabel('사진 추가').setInputFiles({ name: '볼락.png', mimeType: 'image/png', buffer: png });
  await expectFits(page);
  await expectAccessible(page);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('볼락 3마리')).toBeVisible();
  expect(db.records).toHaveLength(26);
  expect(db.record_photos).toHaveLength(2);
});

test('일정: 날짜를 눌러 장소가 붙은 일정을 만들고 삭제한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./schedule?date=2026-11-07');
  await expect(page.getByRole('heading', { name: '새벽 출조' })).toBeVisible();
  await expect(page.getByRole('button', { name: '7 일 (토), 2026년 11월, 일정 1건' })).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);

  await page.getByRole('button', { name: '9 일 (월), 2026년 11월' }).click();
  await expect(page.getByRole('heading', { name: '2026년 11월 9일 (월)' })).toBeVisible();
  await page.getByRole('button', { name: '일정 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 일정' });
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('할 일을 입력해 주세요.')).toBeVisible();
  await expectAccessible(page);

  await dialog.getByLabel('할 일').fill('점심');
  await dialog.getByLabel('시작 시간').fill('12:00');
  await dialog.getByLabel('종료 시간').fill('11:00');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('시작 시간 뒤로 입력해 주세요.')).toBeVisible();
  await dialog.getByLabel('종료 시간').fill('13:00');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: '일정 추가' })).toBeFocused();
  await page.getByRole('button', { name: '일정 추가' }).click();
  await dialog.getByLabel('할 일').fill('점심');
  await dialog.getByLabel('시작 시간').fill('12:00');
  await dialog.getByLabel('종료 시간').fill('13:00');
  await dialog.getByRole('searchbox', { name: '장소 검색' }).fill('백도');
  await dialog.getByRole('searchbox', { name: '장소 검색' }).press('Enter');
  await dialog.getByRole('button', { name: /백도 횟집/ }).click();
  await dialog.getByRole('button', { name: '저장' }).click();

  await expect(page.getByRole('heading', { name: '점심' })).toBeVisible();
  await expect(page.getByRole('button', { name: '일정 추가' })).toBeFocused();
  await expect(page.getByRole('link', { name: '백도 횟집' })).toBeVisible();
  expect(db.places).toHaveLength(4);
  expect(db.places!.at(-1)).toMatchObject({ kind: 'restaurant' });
  expect(db.events!.at(-1)).toMatchObject({ date: '2026-11-09', start_time: '12:00', end_time: '13:00', place_id: 'gen-1' });

  await page.getByRole('button', { name: '점심 일정 삭제' }).click();
  await expect(page.getByRole('heading', { name: '점심' })).toBeHidden();
  expect(db.events).toHaveLength(1);
});

test('일정: 날짜별 준비물을 불러와 체크하고 추가한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./schedule?date=2026-11-07');
  await page.getByRole('button', { name: '기본 목록 불러오기' }).click();
  await page.getByRole('checkbox', { name: '낚싯대' }).click();
  await expect(page.getByRole('checkbox', { name: '낚싯대' })).toBeChecked();
  await expect(page.getByText(/24개 중 1개 챙김/)).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);

  await page.getByLabel('준비물 추가').fill('핫팩');
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '핫팩' })).toBeVisible();
  await page.getByRole('button', { name: '핫팩 삭제' }).click();
  await expect(page.getByRole('checkbox', { name: '핫팩' })).toBeHidden();
  expect(db.checklist_items!.every((item) => item.date === '2026-11-07')).toBe(true);
});

test('키보드: 본문 바로가기와 메뉴 이동이 동작한다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./schedule');
  await expect(page.getByRole('heading', { name: '달력' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문 바로가기' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.getByRole('link', { name: '기록' }).click();
  await expect(page).toHaveTitle('기록 | 낚고먹고');
  await expect(page.locator('#main')).toBeFocused();
});

test('앱 설치 버튼은 메뉴(GNB) 밖, 머리글 맨 오른쪽에 따로 놓인다', async ({ page }, testInfo) => {
  await fakeBackend(page, seed());
  await page.goto('/schedule');
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible();
  // 설치할 수 있는 브라우저가 보내는 설치 제안을 흉내 냅니다.
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);
  });
  const button = page.getByRole('button', { name: '앱 설치' });
  await expect(button).toBeVisible();
  await expect(page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: '앱 설치' })).toHaveCount(0);

  const install = (await button.boundingBox())!;
  const header = (await page.locator('header.topbar').boundingBox())!;
  expect(Math.round(install.x + install.width)).toBe(Math.round(header.x + header.width));

  if (testInfo.project.name === 'desktop') {
    const nav = (await page.getByRole('navigation', { name: '주요 메뉴' }).boundingBox())!;
    expect(install.x - (nav.x + nav.width)).toBeGreaterThanOrEqual(16); // 메뉴와 간격을 두고 따로 묶인다
  }
  await expectFits(page);
});
