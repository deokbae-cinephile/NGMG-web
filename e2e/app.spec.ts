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

test('첫 로딩: 벽을 밀고 로고가 드러난 뒤 앱이 열리고, 새로고침하면 다시 재생하지 않는다', async ({ page }) => {
  await fakeBackend(page, seed(), { intro: true });
  await page.goto('./');
  await expect(page.locator('.intro-wall')).toBeAttached();
  await expect(page.locator('.intro')).toBeHidden({ timeout: 8000 });
  await expect(page.getByRole('button', { name: '장소 추가' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '장소 추가' })).toBeVisible();
  await expect(page.locator('.intro-wall')).toHaveCount(0);
});

test('지도: 검색으로 장소를 추가하고 필터를 기억한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./');
  await expect(page.getByRole('button', { name: '거문도 방파제 (낚시) 선택' })).toBeVisible();
  await expect(page.getByRole('img', { name: '기준 위치: 무악재역' })).toBeVisible();
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
  await dialog.getByLabel('별점').selectOption('5');
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    return canvas.toDataURL('image/png');
  });
  const png = Buffer.from(dataUrl.split(',')[1]!, 'base64');
  await dialog.getByLabel('사진 추가').setInputFiles({ name: '볼락.png', mimeType: 'image/png', buffer: png });
  await expect(dialog.getByRole('img', { name: '올릴 사진 1 미리보기' })).toBeVisible();

  // 잡은 물고기: 길이를 비우면 안내하고, 조사·어종·길이·사진을 함께 저장합니다.
  await dialog.getByRole('button', { name: '물고기 추가' }).click();
  const fish = dialog.getByRole('group', { name: '물고기 1' });
  await fish.getByRole('radio', { name: '류 조사' }).check();
  await fish.getByLabel('어종').fill('볼락');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(fish.getByText('길이를 입력해 주세요.')).toBeVisible();
  await fish.getByLabel('길이 (cm)').fill('21.5');
  await fish.getByLabel('사진', { exact: true }).setInputFiles({ name: '볼락-1.png', mimeType: 'image/png', buffer: png });
  await expect(fish.getByRole('img', { name: '물고기 1 새 사진 미리보기' })).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('볼락 21.5cm')).toBeVisible();
  expect(db.records).toHaveLength(26);
  expect(db.record_photos).toHaveLength(2);
  expect(db.fish_catches).toHaveLength(1);
  expect(db.fish_catches![0]).toMatchObject({ angler: '류 조사', species: '볼락', length_cm: 21.5, position: 0 });
  expect(db.fish_catches![0]!.photo_path).toMatch(/fish-/);
});

test('일정: 날짜를 눌러 장소가 붙은 일정을 만들고 삭제한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./schedule?date=2026-11-07');
  await expect(page.getByRole('heading', { name: '새벽 출조' })).toBeVisible();
  await expect(page.getByRole('button', { name: '7 일 (토), 2026년 11월, 일정 1건' })).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);

  // 달력 키보드: 화살표로 하루, PageDown/PageUp으로 한 달씩 옮깁니다.
  await page.getByRole('button', { name: /^7 일 \(토\), 2026년 11월/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: /^8 일 \(일\), 2026년 11월/ })).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(page.getByRole('heading', { name: '2026년 12월' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^8 일 \(화\), 2026년 12월/ })).toBeFocused();
  await page.keyboard.press('PageUp');
  await expect(page.getByRole('button', { name: /^8 일 \(일\), 2026년 11월/ })).toBeFocused();

  await page.getByRole('button', { name: '9 일 (월), 2026년 11월' }).click();
  await expect(page.getByRole('heading', { name: '2026년 11월 9일 (월)' })).toBeVisible();
  await page.getByRole('button', { name: '일정 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 일정' });
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('할 일을 입력해 주세요.')).toBeVisible();
  await expectAccessible(page);

  await dialog.getByLabel('할 일').fill('점심');
  await dialog.getByLabel('시작 시간').fill('12:00');
  await dialog.getByLabel('종료 날짜').fill('2026-11-08');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('시작 날짜 이후로 입력해 주세요.')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: '일정 추가' })).toBeFocused();
  await page.getByRole('button', { name: '일정 추가' }).click();
  await dialog.getByLabel('할 일').fill('점심');
  await dialog.getByLabel('시작 시간').fill('12:00');
  await dialog.getByLabel('종료 날짜').fill('2026-11-10');
  await dialog.getByRole('searchbox', { name: '장소 검색' }).fill('백도');
  await dialog.getByRole('searchbox', { name: '장소 검색' }).press('Enter');
  await dialog.getByRole('button', { name: /백도 횟집/ }).click();
  await dialog.getByRole('button', { name: '저장' }).click();

  await expect(page.getByRole('heading', { name: '점심' })).toBeVisible();
  await expect(page.getByRole('button', { name: '일정 추가' })).toBeFocused();
  await expect(page.getByRole('link', { name: '백도 횟집' })).toBeVisible();
  expect(db.places).toHaveLength(4);
  expect(db.places!.at(-1)).toMatchObject({ kind: 'restaurant' });
  // 연박 일정은 다음 날에도 보이고 달력에 이어서 표시됩니다.
  await page.getByRole('button', { name: /^10 일 \(화\), 2026년 11월, 일정 1건, 연박 일정/ }).click();
  await expect(page.getByRole('heading', { name: '점심' })).toBeVisible();
  await page.getByRole('button', { name: /^9 일 \(월\), 2026년 11월/ }).click();
  expect(db.events!.at(-1)).toMatchObject({ date: '2026-11-09', end_date: '2026-11-10', start_time: '12:00', end_time: null });

  await page.getByRole('button', { name: '점심 일정 삭제' }).click();
  await expect(page.getByRole('heading', { name: '점심' })).toBeHidden();
  expect(db.events).toHaveLength(1);
});

test('키보드: 본문 바로가기와 메뉴 이동이 동작한다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./schedule');
  await expect(page.getByRole('heading', { name: '달력' })).toBeVisible();
  await expect(page.locator('.intro')).toHaveCount(0); // 첫 로딩이 덮는 동안에는 뒤 화면에 초점이 가지 않습니다.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문 바로가기' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.getByRole('link', { name: '통계' }).click();
  await expect(page).toHaveTitle('통계 | 낚고먹고');
  await expect(page.locator('#main')).toBeFocused();
});

test('앱 설치 버튼은 메뉴 밖 오른쪽 아래에 떠 있다', async ({ page }, testInfo) => {
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
  const { width, height } = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: window.innerHeight }));
  expect(width - (install.x + install.width)).toBeLessThanOrEqual(20);
  expect(install.y + install.height).toBeGreaterThan(height - 120);
  if (testInfo.project.name === 'mobile') {
    const nav = (await page.getByRole('navigation', { name: '주요 메뉴' }).boundingBox())!;
    expect(install.y + install.height).toBeLessThanOrEqual(nav.y); // 하단 탭을 가리지 않습니다.
  }
  await expectFits(page);
});

test('지도: 장소를 빠르게 두 번 저장해도 하나만 생기고, 핀 팝업과 지도 전환 이름이 동작한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./');
  await page.getByRole('button', { name: '장소 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 장소' });
  await dialog.getByLabel('이름').fill('새 포인트');
  await dialog.getByLabel('위도').fill('34.5');
  await dialog.getByLabel('경도').fill('127.5');
  await dialog.getByRole('button', { name: '저장' }).dblclick();
  await expect(dialog).toBeHidden();
  expect(db.places).toHaveLength(4);

  await page.getByRole('button', { name: '거문도 방파제 (낚시) 선택' }).click(); // 같은 지점의 핀은 옆으로 벌려 놓아 모두 눌립니다.
  const popup = page.getByRole('group', { name: '거문도 방파제 정보' });
  await expect(popup.getByText('전남 여수시 삼산면')).toBeVisible();
  await expect(popup.getByRole('link', { name: '상세 보기' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();

  await page.getByRole('button', { name: '위성 지도' }).click();
  await expect(page.getByRole('button', { name: '일반 지도' })).toBeVisible();
});

test('달력: 연도와 월을 골라 이동한다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./schedule?date=2026-11-07');
  await page.getByRole('button', { name: /연도와 월 고르기/ }).click();
  const picker = page.getByRole('group', { name: '연도와 월 고르기' });
  await expect(picker.getByRole('button', { name: '11월' })).toBeFocused();
  await expectAccessible(page);
  await picker.getByRole('button', { name: '다음 해' }).click();
  await picker.getByRole('button', { name: '3월' }).click();
  await expect(page.getByRole('heading', { name: /2027년 3월/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^1 일 \(월\), 2027년 3월/ })).toBeVisible();
});

test('기록: 입력 항목을 줄여도 예전 값은 지워지지 않고, 연박 날짜를 저장한다', async ({ page }) => {
  const base = seed();
  base.records![0] = { ...base.records![0]!, people: 2, companions: '국환, 창선', weather: '맑음' };
  const db = await fakeBackend(page, base);
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '기록 수정' }).first().click();
  const dialog = page.getByRole('dialog', { name: '기록 수정' });
  for (const label of ['인원', '동행', '물때', '바람', '수온']) await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('날씨', { exact: true })).toHaveValue('맑음');
  await expect(dialog.getByRole('button', { name: '물때·날씨 불러오기' })).toHaveCount(0);
  await dialog.getByLabel('종료 날짜').fill('2026-10-31');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.records![0]).toMatchObject({ end_date: '2026-10-31', people: 2, companions: '국환, 창선', weather: '맑음' });
});

test('장비: 조사별로 추가, 수정, 삭제하고 사진을 미리 본다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./gear');
  await page.getByRole('button', { name: '류 조사 장비 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 장비' });
  await expect(dialog.getByRole('radio', { name: '류 조사' })).toBeChecked();
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('장비 이름을 입력해 주세요.')).toBeVisible();
  await dialog.getByLabel('분류', { exact: true }).selectOption('릴');
  await dialog.getByLabel('브랜드').fill('다이와');
  await dialog.getByLabel('장비 이름').fill('뜰채');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await dialog.getByLabel('사진', { exact: true }).setInputFiles({ name: '뜰채.png', mimeType: 'image/png', buffer: png });
  await expect(dialog.getByRole('img', { name: '올릴 장비 사진 미리보기' })).toBeVisible();
  await expectAccessible(page);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: '[다이와] 뜰채' })).toBeVisible();
  expect(db.angler_gear![0]).toMatchObject({ angler: '류 조사', category: '릴', brand: '다이와', name: '뜰채' });
  await expectFits(page);

  await page.getByRole('button', { name: '[다이와] 뜰채 수정' }).click();
  await page.getByRole('dialog', { name: '장비 수정' }).getByLabel('장비 이름').fill('큰 뜰채');
  await page.getByRole('dialog', { name: '장비 수정' }).getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: '[다이와] 큰 뜰채' })).toBeVisible();
  await page.getByRole('button', { name: '[다이와] 큰 뜰채 삭제' }).click();
  await expect(page.getByRole('heading', { name: '[다이와] 큰 뜰채' })).toBeHidden();
  expect(db.angler_gear).toHaveLength(0);
});

test('휴대폰: 머리글 없이 메뉴를 옮기면 맨 위부터 보인다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await fakeBackend(page, seed());
  await page.goto('./records');
  await expect(page.getByText('감성돔 1마리')).toBeVisible();
  await expect(page.locator('.topbar-logo')).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await page.getByRole('link', { name: '통계' }).click();
  await expect(page.getByRole('heading', { name: '조사별 조과' })).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('넓은 화면: 메뉴 왼쪽 선이 오른쪽 칸의 왼쪽 선과 맞는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await fakeBackend(page, seed());
  const check = async (path: string, title: string) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title })).toBeAttached();
    const nav = (await page.getByRole('navigation', { name: '주요 메뉴' }).boundingBox())!;
    const pane = (await page.locator('.pane').last().boundingBox())!;
    expect(Math.round(nav.x)).toBe(Math.round(pane.x));
    return nav;
  };
  const nav = await check('./schedule', '전체 기록');
  // 스크롤바 자리를 비우는 환경이 있어 고정 값 대신 실제 화면 폭과 비교합니다.
  expect(Math.round(nav.x + nav.width)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
  await check('./records', '전체 기록');
  await page.evaluate(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
  });
  await expect(page.getByRole('button', { name: '앱 설치' })).toBeVisible();
  // 설치 버튼이 보여도 메뉴는 오른쪽 칸 너비를 그대로 씁니다.
  const withInstall = await page.getByRole('navigation', { name: '주요 메뉴' }).boundingBox();
  expect(Math.round(withInstall!.x + withInstall!.width)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
  const links = await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().width)));
  expect(new Set(links).size).toBe(1); // 5칸이 같은 너비입니다.
});

test('장소를 지우면 잡은 물고기 사진 파일도 지운다', async ({ page }) => {
  const db = await fakeBackend(page, {
    ...seed(),
    fish_catches: [{ id: 'f1', record_id: 'r00', angler: '김 조사', species: '감성돔', length_cm: 30, photo_path: 'r00/fish.jpg', position: 0 }],
  });
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '장소 삭제' }).click();
  await expect(page.getByRole('button', { name: '장소 추가' })).toBeVisible();
  expect(db.removedFiles).toContain('r00/fish.jpg');
});

test('기록 검색은 어종으로도 찾는다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    fish_catches: [{ id: 'f1', record_id: 'r01', angler: '류 조사', species: '거대 망둥어', length_cm: 17, position: 0 }],
  });
  await page.goto('./records');
  await page.getByLabel('조과·어종·미끼·메뉴·메모에서 찾기').fill('망둥어');
  await page.getByRole('button', { name: '찾기', exact: true }).click();
  await expect(page.locator('.pane-records').getByText('거대 망둥어 17cm')).toBeVisible();
  await expect(page.locator('.pane-records').getByText('감성돔 1마리')).toBeHidden();
});

const gearSeed = () => ({
  ...seed(),
  records: [{ id: 'r1', place_id: 'p1', visited_on: '2026-10-01', gear: '[A] 로드하나, [다이와] 릴하나', catches: '' }],
  angler_gear: [
    { id: 'a', angler: '김 조사', category: '로드', brand: 'A', name: '로드하나', position: 0 },
    { id: 'b', angler: '김 조사', category: '로드', brand: '', name: '로드둘', position: 1 },
    { id: 'c', angler: '김 조사', category: '릴', brand: '다이와', name: '릴하나', position: 0 },
  ],
});

test('장비: 끌어서 옮기고, 위·아래 버튼으로도 옮기며, 사용 횟수를 보여 준다', async ({ page }) => {
  const db = await fakeBackend(page, gearSeed());
  await page.goto('./gear');
  const row = page.locator('[data-gear-item="a"]');
  await expect(row.getByText('사용 1회')).toBeVisible();
  await expectAccessible(page);

  // 로드하나를 로드둘 아래로 끕니다.
  const from = (await row.locator('.gear-handle').boundingBox())!;
  const to = (await page.locator('[data-gear-item="b"]').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, { steps: 2 });
  await page.mouse.up();
  await expect.poll(() => db.angler_gear!.find((item) => item.id === 'a')!.position).toBe(1);
  expect(db.angler_gear!.find((item) => item.id === 'b')!.position).toBe(0);

  // 버튼으로 분류 끝을 넘어가면 다음 분류로 갑니다.
  await page.getByRole('button', { name: '[A] 로드하나 아래로' }).click();
  await expect.poll(() => db.angler_gear!.find((item) => item.id === 'a')!.category).toBe('릴');
  await expect(page.getByRole('button', { name: '[A] 로드하나 아래로' })).toBeFocused();
  await expectFits(page);
});

test('기본값: 새 기록의 장비 칸에 등록한 로드·릴이 들어간다', async ({ page }) => {
  await fakeBackend(page, gearSeed());
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '기록 추가' }).click();
  await expect(page.getByRole('dialog', { name: '새 기록' }).getByLabel('장비', { exact: true })).toHaveValue('[A] 로드하나, 로드둘, [다이와] 릴하나');
});

test('달력: 가운데 연도를 누르면 10년치에서 고른다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./schedule?date=2026-11-07');
  await page.getByRole('button', { name: /연도와 월 고르기/ }).click();
  const picker = page.getByRole('group', { name: '연도와 월 고르기' });
  await picker.getByRole('button', { name: /10년 단위로 연도 고르기/ }).click();
  await expect(picker.getByRole('button', { name: '2026', exact: true })).toBeFocused();
  await expect(picker.getByRole('button', { name: /^20\d\d$/ })).toHaveCount(10);
  await expectAccessible(page);
  await picker.getByRole('button', { name: '다음 10년' }).click();
  await picker.getByRole('button', { name: '2031', exact: true }).click();
  await picker.getByRole('button', { name: '5월' }).click();
  await expect(page.getByRole('heading', { name: /2031년 5월/ })).toBeVisible();
});

test('사진 미리보기의 X 버튼으로 뺀다, 통계 순서, 기록에 인원·동행을 보이지 않는다', async ({ page }) => {
  const base = seed();
  base.records![0] = { ...base.records![0]!, people: 2, companions: '국환, 창선' };
  await fakeBackend(page, base);
  await page.goto('./places/p1');
  await expect(page.getByText('감성돔 1마리')).toBeVisible();
  await expect(page.getByText('국환, 창선')).toHaveCount(0);
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await dialog.getByLabel('사진 추가').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: png });
  await expect(dialog.getByRole('img', { name: '올릴 사진 1 미리보기' })).toBeVisible();
  await dialog.getByRole('button', { name: '사진 1 빼기' }).click();
  await expect(dialog.getByRole('img', { name: '올릴 사진 1 미리보기' })).toHaveCount(0);
  await page.goto('./stats');
  await expect(page.locator('dl dt').first()).toBeVisible();
  expect(await page.locator('main dl').first().locator('dt').allTextContents()).toEqual(['전체 기록', '출조 횟수', '낚시 평균 별점', '맛집 방문', '맛집 평균 별점']);
});

test('장비: 라인은 원줄과 목줄로 나누어 고르고 옮긴다', async ({ page }) => {
  const db = await fakeBackend(page, { ...seed(), angler_gear: [{ id: 'm', angler: '김 조사', category: '라인', subcategory: '원줄', brand: '셉트', name: '합사', position: 0 }] });
  await page.goto('./gear');
  await page.getByRole('button', { name: '김 조사 장비 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 장비' });
  await expect(dialog.getByLabel('세부 분류')).toHaveCount(0);
  await dialog.getByLabel('분류', { exact: true }).selectOption('라인');
  await dialog.getByLabel('세부 분류').selectOption('목줄');
  await dialog.getByLabel('장비 이름').fill('카본');
  await expectAccessible(page);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.angler_gear!.at(-1)).toMatchObject({ category: '라인', subcategory: '목줄', name: '카본' });
  await expect(page.locator('[data-gear-sub="목줄"][data-angler="김 조사"]').getByRole('heading', { name: '카본' })).toBeVisible();

  await page.getByRole('button', { name: '[셉트] 합사 아래로' }).click();
  await expect.poll(() => db.angler_gear!.find((item) => item.id === 'm')!.subcategory).toBe('목줄');
  await expect(page.locator('[data-gear-sub="목줄"][data-angler="김 조사"]').getByRole('heading', { name: '[셉트] 합사' })).toBeVisible();
  await expectAccessible(page);
});

test('무악재역 버튼: 장소로 고르면 말풍선이 뜨고, 세 버튼이 한 줄에 놓이며, 길찾기 출발지가 된다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  const base = page.getByRole('button', { name: '무악재역', exact: true });
  await expect(base).toHaveAttribute('aria-pressed', 'false');
  const boxes = await Promise.all([page.getByRole('button', { name: '지도를 눌러 위치 지정' }), page.getByRole('button', { name: '장소 추가' }), base].map((button) => button.boundingBox()));
  expect(new Set(boxes.map((box) => Math.round(box!.y))).size).toBe(1);
  await base.click();
  await expect(base).toHaveAttribute('aria-pressed', 'true');
  const popup = page.getByRole('group', { name: '무악재역 정보' });
  await expect(popup.getByText('길찾기 출발지')).toBeVisible();
  await expect(popup.getByRole('link', { name: '상세 보기' })).toHaveCount(0);
  await expectFits(page);
  await expectAccessible(page);
  await base.click();
  await expect(popup).toBeHidden();

  await page.goto('./places/p2');
  await expect(page.getByRole('link', { name: '길찾기 (새 창)' })).toHaveAttribute('href', /link\/by\/car\/%EB%AC%B4%EC%95%85%EC%9E%AC%EC%97%AD,37\.5825632,126\.950231\//);
});

test('이미 기록한 일정에는 기록 남기기가 없고, 장비는 쉼표로 이어 보인다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    events: [
      { id: 'done', date: '2026-11-07', start_time: '06:00:00', title: '다녀온 출조', place_id: 'p1', memo: '' },
      { id: 'todo', date: '2026-11-07', start_time: '09:00:00', title: '남은 출조', place_id: 'p2', memo: '' },
    ],
    records: [{ id: 'x', place_id: 'p1', visited_on: '2026-11-07', gear: '[A] 로드\n[B] 릴 [C] 채비', catches: '' }],
  });
  await page.goto('./schedule?date=2026-11-07');
  await expect(page.getByRole('button', { name: '남은 출조 기록 남기기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다녀온 출조 기록 남기기' })).toHaveCount(0);
  await expect(page.getByText('[A] 로드, [B] 릴, [C] 채비').first()).toBeVisible();
});

test('기록 화면에서 기록을 수정하고, 장비에 미끼 분류를 쓴다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./records');
  await page.getByRole('button', { name: /거문도 방파제 .*기록 수정/ }).first().click();
  const dialog = page.getByRole('dialog', { name: '기록 수정' });
  await dialog.getByLabel('날씨').selectOption('폭우');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('(폭우)').first()).toBeVisible();
  expect(db.records).toHaveLength(25);

  await page.goto('./gear');
  await expect(page.getByRole('region', { name: '김 조사 미끼' })).toBeVisible();
  await page.getByRole('button', { name: '김 조사 장비 추가' }).click();
  const gear = page.getByRole('dialog', { name: '새 장비' });
  await gear.getByLabel('분류', { exact: true }).selectOption('미끼');
  await gear.getByLabel('장비 이름').fill('크릴');
  await gear.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('region', { name: '김 조사 미끼' }).getByRole('heading', { name: '크릴' })).toBeVisible();
});

test('어종 도감: 어종별로 모으고 빅원의 길이와 잡은 조사를 보여 준다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    fish_catches: [
      { id: 'f1', record_id: 'r00', angler: '김 조사', species: '감성돔', length_cm: 30, position: 0 },
      { id: 'f2', record_id: 'r01', angler: '류 조사', species: '감성돔 ', length_cm: 42.5, position: 0 },
      { id: 'f3', record_id: 'r02', angler: '김 조사', species: '거대 망둥어', length_cm: 17, position: 0 },
      { id: 'f4', record_id: 'r03', angler: '김 조사', species: '', length_cm: 10, position: 0 },
    ],
  });
  await page.goto('./dex');
  await expect(page.getByRole('status').filter({ hasText: '2종 발견' })).toHaveText('2종 발견 · 총 4마리');
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '감성돔' }) });
  await expect(card.getByText('42.5cm')).toBeVisible();
  await expect(card.getByText('류 조사')).toBeVisible();
  await expect(card.getByText('2마리')).toBeVisible();
  await expect(page.getByRole('heading', { name: '거대 망둥어' })).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);
});

test('지도: 평균 별점에 따라 핀 색이 바뀌고 숫자로도 보여 준다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    records: [
      { id: 'a', place_id: 'p1', visited_on: '2026-10-01', rating: 5 },
      { id: 'b', place_id: 'p1', visited_on: '2026-10-02', rating: 4 },
      { id: 'c', place_id: 'p2', visited_on: '2026-10-03', rating: 2 },
    ],
  });
  await page.goto('./');
  const pin = page.getByRole('button', { name: /거문도 방파제 \(낚시\) 선택, 평균 별점 4\.5$/ });
  await expect(pin).toHaveClass(/rate-4/);
  await expect(pin.locator('.pin-score')).toHaveText('4.5');
  await expect(page.getByRole('button', { name: /바다횟집 \(맛집\) 선택, 평균 별점 2\.0$/ })).toHaveClass(/rate-2/);
  const none = page.getByRole('button', { name: new RegExp(`${LONG_NAME} \\(낚시\\) 선택$`) });
  await expect(none).not.toHaveClass(/rate-/);
  await pin.click();
  await expect(page.getByRole('group', { name: '거문도 방파제 정보' }).getByText('4.5')).toBeVisible();
  await expectAccessible(page);
});

test('저장하는 동안 저장 중 화면을 띄우고 닫기를 막는다', async ({ page }) => {
  await fakeBackend(page, seed());
  // 확인이 끝날 때까지 저장 응답을 붙잡아 둡니다.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/fake-supabase/rest/**', async (route) => {
    if (route.request().method() === 'POST') await held;
    await route.fallback();
  });
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  await dialog.getByRole('button', { name: '저장' }).click();
  const notice = dialog.getByText('저장하는 중입니다.');
  await expect(notice).toBeVisible();
  await expect(notice).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByLabel('메모')).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  release();
  await expect(dialog).toBeHidden();
});

test('기록 사진 여러 장은 슬라이드로 넘긴다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    record_photos: [
      { id: 'a', record_id: 'r00', storage_path: 'r00/1.jpg', position: 0 },
      { id: 'b', record_id: 'r00', storage_path: 'r00/2.jpg', position: 1 },
    ],
  });
  await page.goto('./places/p1');
  const slider = page.getByRole('region', { name: /기록 사진 2장/ });
  await expect(slider.getByText('1 / 2')).toBeVisible();
  await expect(slider.getByRole('button', { name: '이전 사진' })).toBeDisabled();
  await slider.getByRole('button', { name: '다음 사진' }).click();
  await expect(slider.getByText('2 / 2')).toBeVisible();
  await expect(page.getByText('옆으로 넘겨 보기')).toHaveCount(0);
  await expectAccessible(page);
});
