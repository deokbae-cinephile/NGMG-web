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

/** 일정 및 기록 화면을 열고, 휴대폰처럼 전체 기록이 접혀 있으면 펼칩니다. */
const openRecords = async (page: Page) => {
  await page.goto('./records');
  await expect(page.getByRole('heading', { name: '전체 기록' })).toBeVisible();
  const toggle = page.getByRole('button', { name: '전체 기록' });
  if (await toggle.isVisible()) {
    await expect(toggle).toHaveAttribute('aria-expanded', 'false'); // 휴대폰에서는 접힌 채로 시작합니다.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
};

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
  // 방금 누른 단추 위에 마우스가 남아 색이 바뀌는 중(0.15초)이면 중간 색으로 대비를 재므로, 마우스를 치우고 전환이 끝나길 기다립니다.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  // 화면 확대 막기(meta-viewport)는 사용자 결정이라 검사에서 뺍니다(WCAG 1.4.4 위반임을 알고 정함, 2026-11-10).
  const { violations } = await new AxeBuilder({ page }).disableRules(['meta-viewport']).analyze();
  // 개별 삭제 버튼의 포인트 색 글자는 사용자 결정이라 명도 대비 위반에서만 뺍니다.
  const found = violations.flatMap((item) => {
    const nodes = item.id === 'color-contrast' ? item.nodes.filter((node) => !node.html.includes('text-action-accent')) : item.nodes;
    return nodes.length ? [`${item.id}: ${nodes.map((node) => node.target).join(' | ')}`] : [];
  });
  expect(found).toEqual([]);
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

test('첫 로딩: 스플래시 로고가 보인 뒤 앱이 열리고, 새로고침하면 다시 보이지 않는다', async ({ page }) => {
  await fakeBackend(page, seed(), { intro: true });
  await page.goto('./');
  await expect(page.locator('.splash .logo')).toBeAttached();
  await expect(page.locator('.splash')).toBeHidden({ timeout: 8000 });
  await expect(page.getByRole('button', { name: '장소 추가' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '장소 추가' })).toBeVisible();
  await expect(page.locator('.splash .logo')).toHaveCount(0);
});

test('지도: 검색으로 장소를 추가하고, 분류 필터는 다른 메뉴에 다녀오면 전체로 돌아간다', async ({ page }) => {
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

  await page.getByLabel('이름·주소로 찾기').fill('거문도');
  await expect(page.getByRole('status').last()).toHaveText('장소 1곳');
  await page.getByLabel('이름·주소로 찾기').clear();

  await page.getByRole('button', { name: '맛집', exact: true }).click();
  await expect(page.getByRole('button', { name: '거문도 방파제 (낚시) 선택' })).toBeHidden();
  // 다른 메뉴에 다녀오면 다시 '전체'에서 시작합니다.
  await page.getByRole('link', { name: '통계' }).first().click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByRole('heading', { name: /년 통계$/ })).toBeVisible(); // 통계 화면이 다 뜬 뒤 지도로 돌아갑니다.
  await page.getByRole('link', { name: '지도' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '전체', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '거문도 방파제 (낚시) 선택' })).toBeVisible();
});

test('장소: 수정하고 삭제한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./places/p2');
  await expect(page.getByRole('heading', { name: '바다횟집', exact: true })).toBeVisible();
  await expect(page.getByText(/\d+\.\d{5}, \d+\.\d{5}/)).toHaveCount(0); // 상세에도 좌표를 쓰지 않습니다.
  await expectFits(page);
  await expectAccessible(page);

  await page.getByRole('button', { name: '장소 수정' }).click();
  const dialog = page.getByRole('dialog', { name: '장소 수정' });
  await dialog.getByLabel('이름').fill('');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('이름을 입력해 주세요.')).toBeVisible();
  await dialog.getByLabel('이름').fill('푸른바다횟집');
  await expect(dialog.getByLabel('위도')).toHaveCount(0); // 위도·경도는 보이지 않습니다(사용자 요청).
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
  // 평점은 조사마다 따로 주고, 두 사람이 다 주면 평균을 냅니다.
  await dialog.getByLabel('김 조사 평점').selectOption('5');
  await dialog.getByLabel('류 조사 평점').selectOption('3.5');
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
  await expect(page.getByRole('region', { name: '기록', exact: true }).getByText('볼락 21.5cm')).toBeVisible();
  await expect(page.getByRole('region', { name: '잡은 물고기 사진' }).getByRole('img')).toHaveCount(1); // 사진 지도에도 모입니다.

  expect(db.records).toHaveLength(26);
  expect(db.record_photos).toHaveLength(2);
  expect(db.fish_catches).toHaveLength(1);
  expect(db.fish_catches![0]).toMatchObject({ angler: '류 조사', species: '볼락', length_cm: 21.5, position: 0 });
  expect(db.fish_catches![0]!.photo_path).toMatch(/fish-/);
  expect(db.records!.at(-1)).toMatchObject({ rating: 4.3, angler_ratings: { '김 조사': 5, '류 조사': 3.5 } });
});

test('일정: 날짜를 눌러 장소가 붙은 일정을 만들고 삭제한다', async ({ page }, testInfo) => {
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
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 일정' });
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('할 일을 입력해 주세요.')).toBeVisible();
  await expectAccessible(page);

  await dialog.getByLabel('할 일').fill('점심');
  await dialog.getByLabel('종료 날짜').fill('2026-11-08');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('시작 날짜 이후로 입력해 주세요.')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: '일정 추가', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '일정 추가', exact: true }).click();
  await dialog.getByLabel('할 일').fill('점심');
  await dialog.getByLabel('종료 날짜').fill('2026-11-10');
  await dialog.getByRole('searchbox', { name: '장소 검색' }).fill('백도');
  await dialog.getByRole('searchbox', { name: '장소 검색' }).press('Enter');
  await dialog.getByRole('button', { name: /백도 횟집/ }).click();
  await dialog.getByRole('button', { name: '저장' }).click();

  await expect(page.getByRole('heading', { name: '점심' })).toBeVisible();
  // 저장하면 넓은 화면은 연 단추로, 휴대폰은 알림창이 닫히며 고른 날 제목으로 초점이 갑니다.
  if (testInfo.project.name === 'desktop') await expect(page.getByRole('button', { name: '일정 추가', exact: true })).toBeFocused();
  else await expect(page.locator('.cal-day.is-selected')).toBeFocused();
  await expect(page.getByRole('link', { name: '백도 횟집' })).toBeVisible();
  expect(db.places).toHaveLength(4);
  expect(db.places!.at(-1)).toMatchObject({ kind: 'restaurant' });
  // 연박 일정은 다음 날에도 보이고 달력에 이어서 표시됩니다.
  await page.getByRole('button', { name: /^10 일 \(화\), 2026년 11월, 일정 1건, 연박 일정/ }).click();
  await expect(page.getByRole('heading', { name: '점심' })).toBeVisible();
  await page.getByRole('button', { name: /^9 일 \(월\), 2026년 11월/ }).click();
  expect(db.events!.at(-1)).toMatchObject({ date: '2026-11-09', end_date: '2026-11-10', start_time: '00:00:00', end_time: null }); // 시작 시간은 받지 않아 새 일정은 0시로 둡니다.

  await page.getByRole('button', { name: '점심 일정 삭제' }).click();
  await expect(page.getByRole('heading', { name: '점심' })).toBeHidden();
  expect(db.events).toHaveLength(1);
});

test('키보드: 본문 바로가기와 메뉴 이동이 동작한다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./schedule');
  await expect(page.getByRole('heading', { name: '달력' })).toBeVisible();
  await expect(page.locator('.splash')).toHaveCount(0); // 첫 화면이 덮는 동안에는 뒤 화면에 초점이 가지 않습니다.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문 바로가기' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.getByRole('link', { name: '통계' }).click();
  await expect(page).toHaveTitle('통계 | 낚고먹고');
  await expect(page.locator('#main')).toBeFocused();
});

test('설정: 평점 대기 배지와 목록, 출조 알림, 화면 테마, 앱 설치, 앱 정보', async ({ page }) => {
  const base = seed();
  base.records![0] = { ...base.records![0]!, rating: null, angler_ratings: { '김 조사': 4 } }; // 한 사람만 평점을 줌
  await fakeBackend(page, base);
  await page.goto('./');
  // 평점 대기가 있으면 설정 메뉴에 건수를 붙입니다.
  const settings = page.getByRole('link', { name: /설정.*평점 대기 1건/ });
  await expect(settings.first()).toBeVisible();
  await settings.first().click();
  await expect(page).toHaveTitle('설정 | 낚고먹고');
  await expect(page.getByRole('region', { name: '평점 대기' }).getByRole('link', { name: /거문도 방파제.*류 조사 평점 필요/ })).toBeVisible(); // 평점을 줘야 하는 사람을 밝힙니다.
  await expect(page.getByRole('region', { name: '알림', exact: true }).getByRole('button', { name: '알림 켜기' })).toBeEnabled();

  // 화면 테마: 라이트·다크 중에서 고릅니다(기기 설정 따르기는 없음).
  const theme = page.getByRole('region', { name: '화면 테마' });
  await expect(theme.getByRole('radio')).toHaveCount(0); // 라디오 대신 단추입니다.
  await expect(theme.getByRole('button')).toHaveCount(2);
  await theme.getByRole('button', { name: '다크' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(theme.getByRole('button', { name: '다크' })).toHaveAttribute('aria-pressed', 'true');
  await theme.getByRole('button', { name: '라이트' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // 앱 설치: 설치할 수 있는 브라우저가 보내는 설치 제안을 흉내 냅니다.
  await page.evaluate(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
  });
  await expect(page.getByRole('region', { name: '앱 설치' }).getByRole('button', { name: '앱 설치' })).toBeVisible();
  await expect(page.getByRole('region', { name: '앱 정보' })).toContainText(/v\d+\.\d+\.\d+/);
  await expectFits(page);
  await expectAccessible(page);

  // 예전 장비 주소는 설정으로 넘깁니다.
  await page.goto('./gear');
  await expect(page).toHaveURL(/\/settings$/);
});

test('지도: 장소를 빠르게 두 번 저장해도 하나만 생기고, 핀 팝업과 지도 전환 이름이 동작한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./');
  // 위치 없이 저장하면 위치를 고르라고 안내합니다.
  await page.getByRole('button', { name: '장소 추가' }).click();
  let dialog = page.getByRole('dialog', { name: '새 장소' });
  await dialog.getByLabel('이름').fill('새 포인트');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByRole('alert')).toContainText('위치가 없습니다');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // 지도를 눌러 위치를 지정하면 위도·경도가 채워진 새 장소 창이 열립니다.
  await page.getByRole('button', { name: '지도를 눌러 위치 지정' }).click();
  const box = (await page.getByTestId('map').boundingBox())!;
  await page.getByTestId('map').click({ position: { x: box.width * 0.75, y: box.height * 0.45 } }); // 평점 안내·핀이 없는 자리
  dialog = page.getByRole('dialog', { name: '새 장소' });
  await dialog.getByLabel('이름').fill('새 포인트');
  await dialog.getByRole('button', { name: '저장' }).dblclick();
  await expect(dialog).toBeHidden();
  expect(db.places).toHaveLength(4);

  await page.getByRole('button', { name: '거문도 방파제 (낚시) 선택' }).click(); // 같은 지점의 핀은 옆으로 벌려 놓아 모두 눌립니다.
  const popup = page.getByRole('group', { name: '거문도 방파제 정보' });
  await expect(popup.getByText('전남 여수시 삼산면')).toBeVisible();
  await expect(popup.getByRole('link', { name: '자세히 보기' })).toBeFocused();
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

test('휴대폰: 머리글 없이 메뉴를 옮기면 맨 위부터 보인다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await fakeBackend(page, seed());
  await openRecords(page);
  await expect(page.getByText('감성돔 1마리')).toBeVisible();
  await expect(page.locator('.topbar-logo')).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  await page.getByRole('link', { name: '통계' }).click();
  await expect(page.getByRole('heading', { name: '월별 출조' })).toBeAttached();
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

test('기록 검색: 어종·장소 이름으로 찾는다', async ({ page }) => {
  const base = seed();
  await fakeBackend(page, {
    ...base,
    records: [
      ...base.records!,
      { id: 's1', place_id: 'p2', visited_on: '2026-09-01', catches: '', memo: '모둠회' },
    ],
    fish_catches: [{ id: 'f1', record_id: 'r01', angler: '류 조사', species: '거대 망둥어', length_cm: 17, position: 0 }],
  });
  await openRecords(page);
  const pane = page.locator('.pane-records');
  const search = page.getByRole('searchbox', { name: /기록 찾기/ });
  await expect(page.getByText('장소·조과·어종·메뉴·메모에서 찾기')).toHaveCount(0); // 안내 문구는 화면에 없습니다.
  await search.fill('망둥어');
  await page.getByRole('button', { name: '찾기', exact: true }).click();
  await expect(pane.getByText('거대 망둥어 17cm')).toBeVisible();
  await expect(pane.getByText('감성돔 1마리')).toBeHidden();

  // 장소 이름으로도 찾습니다.
  await search.fill('바다횟');
  await page.getByRole('button', { name: '찾기', exact: true }).click();
  await expect(pane.getByText('모둠회')).toBeVisible();
  await expect(pane.getByText('감성돔 2마리')).toBeHidden();
  await search.fill('');

  await expect(pane.getByText(/조건 더 보기/)).toHaveCount(0);
  await expectAccessible(page);
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
  expect(await page.locator('main dl').first().locator('dt').allTextContents()).toEqual(['출조 횟수', '잡은 물고기']);
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
  await expect(popup.getByText('길찾기 출발지')).toHaveCount(0);
  await expect(popup.getByRole('link', { name: '자세히 보기' })).toHaveCount(0);
  await expectFits(page);
  await expectAccessible(page);
  await base.click();
  await expect(popup).toBeHidden();

  await page.goto('./places/p2');
  await expect(page.getByRole('link', { name: '길찾기 (새 창)' })).toHaveAttribute('href', /link\/by\/car\/%EB%AC%B4%EC%95%85%EC%9E%AC%EC%97%AD,37\.5825632,126\.950231\//);
});

test('이미 기록한 일정에는 기록 남기기가 없고, 예전 장비 글은 보이지 않는다', async ({ page }) => {
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
  await expect(page.getByRole('region', { name: '기록', exact: true }).getByRole('article').getByText(/로드|채비/)).toHaveCount(0); // 장비는 사용자 요청으로 뺐습니다(저장 값은 그대로).
});

test('기록 화면에서 기록을 수정한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await openRecords(page);
  await page.getByRole('button', { name: /거문도 방파제 .*기록 수정/ }).first().click();
  const dialog = page.getByRole('dialog', { name: '기록 수정' });
  await dialog.getByLabel('날씨').selectOption('폭우');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/\/ 폭우$/).first()).toBeVisible();
  expect(db.records).toHaveLength(25);
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
    records: [...seed().records!, { id: 'm1', place_id: 'p2', visited_on: '2026-11-01', catches: '' }],
    menu_items: [{ id: 'x1', record_id: 'm1', name: '모둠회', price: 30000, rating: 4, position: 0 }, { id: 'x2', record_id: 'm1', name: '매운탕', position: 1, angler_ratings: { '류 조사': 3.5 } }],
  });
  await page.goto('./dex');
  await expect(page.getByRole('heading', { name: '어종 도감' })).toBeAttached();
  await expect(page.getByText(/종 발견|총 \d+마리/)).toHaveCount(0); // 집계 문구는 사용자 요청으로 뺐습니다.
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '감성돔' }) });
  await expect(card.getByText('42.5cm')).toBeVisible();
  await expect(card.getByText('류 조사')).toBeVisible();
  await expect(card.getByText('2마리')).toBeVisible();
  // 시간과 장소는 따로 한 줄씩, 모두 5줄입니다.
  expect(await card.locator('dt').allTextContents()).toEqual(['빅원', '조사', '시간', '장소', '마릿수']);
  await expect(page.getByRole('heading', { name: '거대 망둥어' })).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);
  await page.getByRole('button', { name: '음식 도감' }).click();
  await expect(page.getByRole('heading', { name: '음식 도감' })).toBeAttached(); // 제목은 화면 읽기 프로그램에만 알립니다(탭으로 보임).
  await expect(page.getByText(/종 수집|총 \d+개/)).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '모둠회' }) }).getByText('30,000원')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '모둠회' }) }).getByText('4.0점')).toBeVisible();
  // 음식 도감은 번호 없이 평점 높은 순입니다.
  await expect(page.getByText(/^No\./)).toHaveCount(0);
  const menus = await page.getByRole('listitem').getByRole('heading', { level: 3 }).allTextContents();
  expect(menus).toEqual(['모둠회', '매운탕']);
  // 한 사람만 준 평점도 보여 줍니다.
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '매운탕' }) }).getByText('류 조사 3.5점 (평점 대기)')).toBeVisible();

  // 기록에도 보이고, 수정 폼을 열면 준 평점이 그대로 골라져 있습니다(다시 저장해도 지워지지 않음).
  await page.goto('./places/p2');
  await expect(page.getByText('류 조사 3.5점 / 김 조사 평점 대기')).toBeVisible();
  await page.getByRole('button', { name: /기록 수정/ }).first().click();
  await expect(page.getByRole('dialog', { name: '기록 수정' }).getByLabel(/음식 2 류 조사 평점/)).toHaveValue('3.5');
});

test('지도: 평균 평점에 따라 핀 색이 바뀌고 숫자로도 보여 준다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    records: [
      { id: 'a', place_id: 'p1', visited_on: '2026-10-01', rating: 5 },
      { id: 'b', place_id: 'p1', visited_on: '2026-10-02', rating: 4 },
      { id: 'c', place_id: 'p2', visited_on: '2026-10-03', rating: 2 },
    ],
  });
  await page.goto('./');
  const pin = page.getByRole('button', { name: /거문도 방파제 \(낚시\) 선택, 평균 평점 4\.5$/ });
  await expect(pin).toHaveClass(/rate-4/);
  await expect(pin.locator('.pin-score')).toHaveText('4.5');
  await expect(page.getByRole('button', { name: /바다횟집 \(맛집\) 선택, 평균 평점 2\.0$/ })).toHaveClass(/rate-2/);
  const none = page.getByRole('button', { name: new RegExp(`${LONG_NAME} \\(낚시\\) 선택$`) });
  await expect(none).not.toHaveClass(/rate-/);
  await pin.click();
  await expect(page.getByRole('group', { name: '거문도 방파제 정보' }).getByText('4.5')).toBeVisible();
  // 장소 목록은 늘 평점 높은 순이고, 평점이 없는 장소는 뒤에 옵니다.
  const items = page.getByRole('list', { name: '장소 목록' }).getByRole('listitem');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('거문도 방파제');
  await expect(items.nth(1)).toContainText('바다횟집');
  await expect(items.nth(2)).toContainText(LONG_NAME);
  await expect(page.getByLabel('정렬')).toHaveCount(0);
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

test.describe('터치 화면', () => {
  test.use({ hasTouch: true });
  test('기록 사진은 손가락으로 밀어 넘긴다', async ({ page }) => {
    // 화면 확대를 막는 touch-action: manipulation 아래에서도 옆으로 미는 동작을 브라우저가 가져가지 않아야 합니다.
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
    await slider.scrollIntoViewIfNeeded();
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y }] });
    const start = box.x + box.width * 0.8;
    await touch('touchStart', start);
    for (let step = 1; step <= 10; step += 1) await touch('touchMove', start - box.width * 0.06 * step);
    await touch('touchEnd');
    await expect(slider.getByText('2 / 2')).toBeVisible();
  });
});

test('일정 및 기록: 넓은 화면은 페이지 전체가 아니라 칸마다 스크롤한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await fakeBackend(page, seed());
  for (const width of [1280, 1100]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('./schedule?date=2026-11-07');
    await expect(page.getByText('감성돔 1마리').first()).toBeVisible();
    const sizes = await page.evaluate(() => {
      const doc = document.documentElement;
      const main = document.querySelector('main')!;
      return { document: doc.scrollHeight - doc.clientHeight, main: main.scrollHeight - main.clientHeight };
    });
    expect(sizes.document).toBeLessThanOrEqual(0);
    expect(sizes.main).toBeLessThanOrEqual(1);
    const records = page.locator('.pane-records');
    expect(await records.evaluate((pane) => pane.scrollHeight > pane.clientHeight)).toBe(true);
  }
});

test('지도: 평균 5점 장소에도 색이 있다', async ({ page }) => {
  await fakeBackend(page, { ...seed(), records: [{ id: 'a', place_id: 'p1', visited_on: '2026-10-01', rating: 5 }] });
  await page.goto('./');
  await expect(page.getByRole('button', { name: /거문도 방파제 \(낚시\) 선택, 평균 평점 5\.0$/ })).toHaveClass(/rate-5/);
  await expect(page.getByRole('group', { name: /1점대부터 5점까지/ }).getByText('5', { exact: true })).toBeVisible();
});

test('통계: 출조 횟수·잡은 물고기, 월별 출조, 자주 간 낚시 포인트·맛집만 보여 준다', async ({ page }) => {
  // 통계는 기록이 있는 가장 최근 해를 먼저 보여 줍니다. 시계를 고정해 그해가 2026년이 되게 합니다.
  const year = 2026;
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00+09:00'));
  await fakeBackend(page, {
    places: [place('p1', '거문도 방파제'), place('p4', '가거도 갯바위'), place('p2', '바다횟집', 'restaurant')],
    records: [
      { id: 'a', place_id: 'p1', visited_on: `${year}-01-05`, catches: '' },
      { id: 'b', place_id: 'p1', visited_on: `${year}-01-20`, catches: '' },
      { id: 'c', place_id: 'p4', visited_on: `${year}-02-03`, catches: '' },
      { id: 'old', place_id: 'p1', visited_on: `${year - 1}-01-10`, catches: '' },
      {
        id: 'm', place_id: 'p2', visited_on: `${year}-01-06`, catches: '', rating: 4, angler_ratings: { '김 조사': 5, '류 조사': 3 },
      },
    ],
    fish_catches: [
      { id: 'f1', record_id: 'a', angler: '김 조사', species: '감성돔', length_cm: 30, position: 0 },
      { id: 'f2', record_id: 'a', angler: '류 조사', species: '볼락', length_cm: 20, position: 1 },
      { id: 'f3', record_id: 'c', angler: '김 조사', species: '감성돔', length_cm: 41, position: 0 },
      { id: 'f4', record_id: 'old', angler: '김 조사', species: '볼락', length_cm: 25, position: 0 },
    ],
    menu_items: [{ id: 'x1', record_id: 'm', name: '모둠회', price: 50000, position: 0, angler_ratings: { '김 조사': 4, '류 조사': 4 } }],
  });
  await page.goto('./stats');
  const tiles = page.locator('main dl').first();
  await expect(tiles).toContainText('출조 횟수3회');
  await expect(tiles).toContainText('잡은 물고기3마리');
  await expect(tiles.getByText(/작년/)).toHaveCount(0); // 작년 비교는 사용자 요청으로 뺐습니다.

  // 사용자 요청으로 뺀 통계
  for (const name of ['김 조사 vs 류 조사', '맛집', '평점 성향', '어종별 조과', '월별 어종', '장소별 조과율', '최대어 기록 변화']) await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
  // 자주 간 장소는 낚시 포인트(왼쪽)와 맛집(오른쪽)으로 나눕니다.
  const spots = page.getByRole('region', { name: '자주 간 낚시 포인트' });
  await expect(spots.getByRole('listitem')).toHaveText([/거문도 방파제\s*2마리\s*2번/, /가거도 갯바위\s*1마리\s*1번/]);
  const restaurants = page.getByRole('region', { name: '자주 간 맛집' });
  await expect(restaurants.getByRole('listitem')).toHaveText([/바다횟집\s*평균 평점\s*4\.0\s*1번/]);
  await expectFits(page);
  await expectAccessible(page);
});

test('기록: 폼을 연 뒤 다른 사람이 고쳤으면 덮어쓸지 묻는다', async ({ page }) => {
  const base = seed();
  base.records![0] = { ...base.records![0]!, updated_at: '2026-11-01T00:00:00+00:00' };
  const db = await fakeBackend(page, base);
  await openRecords(page);
  await page.getByRole('button', { name: /2026년 10월 30일 .* 기록 수정/ }).click();
  const dialog = page.getByRole('dialog', { name: '기록 수정' });
  await dialog.getByLabel('메모').fill('내가 쓴 메모');
  db.records![0]!.updated_at = '2026-11-02T00:00:00+00:00'; // 다른 사람이 먼저 저장
  const messages: string[] = [];
  page.on('dialog', (confirm) => messages.push(confirm.message())); // 수락은 위의 공통 설정이 합니다.
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(messages.join()).toContain('먼저 고쳤습니다');
  expect(db.records!.find((row) => row.id === 'r00')!.memo).toBe('내가 쓴 메모');
});

test('기록: 오프라인에서 저장하면 대기열에 두었다가 연결되면 올린다', async ({ page, context }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./places/p1');
  await expect(page.getByText('감성돔 1마리')).toBeVisible();
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  await dialog.getByLabel('메모').fill('바다에서 쓴 기록');
  await context.setOffline(true);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: '저장 대기 1건' })).toBeVisible();
  expect(db.records).toHaveLength(25);
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: '저장 대기 1건' })).toBeHidden();
  expect(db.records).toHaveLength(26);
  expect(db.records!.at(-1)!.memo).toBe('바다에서 쓴 기록');
});

test('기록: 저장을 빠르게 두 번 눌러도 한 번만 저장하고 가짜 충돌 안내가 뜨지 않는다', async ({ page }) => {
  const base = seed();
  base.records![0] = { ...base.records![0]!, updated_at: '2026-11-01T00:00:00+00:00' };
  await fakeBackend(page, base);
  const saves: string[] = [];
  page.on('request', (request) => request.method() === 'POST' && request.url().includes('/rest/v1/records') && saves.push(request.url()));
  const messages: string[] = [];
  page.on('dialog', (dialog) => messages.push(dialog.message()));
  await openRecords(page);
  await page.getByRole('button', { name: /2026년 10월 30일 .* 기록 수정/ }).click();
  const dialog = page.getByRole('dialog', { name: '기록 수정' });
  await dialog.getByLabel('메모').fill('한 번만');
  // 화면이 다시 그려지기 전에 두 번 누릅니다(사람의 빠른 연속 클릭과 같음).
  await dialog.getByRole('button', { name: '저장' }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(dialog).toBeHidden();
  expect(saves).toHaveLength(1);
  expect(messages).toEqual([]);
});

test('사진 지도: 장소 상세에서 잡은 물고기 사진을 모아 보고, 지도 말풍선에는 사진을 넣지 않는다', async ({ page }) => {
  const base = seed();
  await fakeBackend(page, {
    ...base,
    // 다른 장소(p3)에서 가장 최근에 잡은 사진은 p1의 사진 모음에 나오면 안 됩니다.
    records: [...base.records!, { id: 'r-other', place_id: 'p3', visited_on: '2026-10-31', catches: '', memo: '' }],
    fish_catches: [
      { id: 'f0', record_id: 'r-other', angler: '김 조사', species: '참돔', length_cm: 50, position: 0, photo_path: 'r-other/fish-0.jpg' },
      { id: 'f1', record_id: 'r00', angler: '김 조사', species: '감성돔', length_cm: 38, position: 0, photo_path: 'r00/fish-1.jpg' },
      { id: 'f2', record_id: 'r05', angler: '류 조사', species: '볼락', length_cm: 21, position: 0, photo_path: 'r05/fish-2.jpg' },
      { id: 'f3', record_id: 'r06', angler: '류 조사', species: '우럭', length_cm: 25, position: 0, photo_path: null },
      { id: 'f4', record_id: 'r07', angler: '김 조사', species: '볼락', length_cm: 18, position: 0, photo_path: 'r07/fish-4.jpg' },
      { id: 'f5', record_id: 'r08', angler: '김 조사', species: '볼락', length_cm: 19, position: 0, photo_path: 'r08/fish-5.jpg' },
    ],
  });
  await page.goto('./places/p1');
  const section = page.getByRole('region', { name: '잡은 물고기 사진' });
  await expect(section.getByRole('img')).toHaveCount(4); // 사진이 없는 우럭은 빠집니다.
  await expect(section.getByRole('img').first()).toHaveAccessibleName(/감성돔 38cm 김 조사 2026년 10월 30일/); // 최근 순
  await expectFits(page);
  await expectAccessible(page);

  await page.goto('./');
  await page.getByRole('button', { name: /거문도 방파제 \(낚시\) 선택/ }).click();
  const popup = page.getByRole('group', { name: '거문도 방파제 정보' });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('img')).toHaveCount(0); // 말풍선에는 사진을 넣지 않습니다(사용자 요청). 사진은 장소 상세에서 봅니다.
});

test('지도: 평점 응답이 늦어도 3초 뒤에는 이름순 목록을 보여 준다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.route(/\/rest\/v1\/records\?select=place_id%2C\+?rating/, () => undefined); // 평점 응답이 오지 않음
  await page.goto('./');
  await expect(page.getByText('평점을 불러오는 중이라 이름순으로 보여 줍니다.')).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole('list', { name: '장소 목록' }).getByRole('listitem')).toHaveCount(3);
});

test('장비를 뺀 뒤에도 기록·일정을 고쳐 저장하면 예전 장비 값은 그대로 남는다', async ({ page }) => {
  const base = seed();
  const oldGear = { gear: '[다이와] 레가리스', rig: '구멍찌', bait: '크릴', gear_sets: [{ angler: '김 조사', name: '찌낚시 세트', items: [] }] };
  base.records![0] = { ...base.records![0]!, ...oldGear };
  base.events = [{ ...base.events![0]!, gear_set_ids: ['set-1'] }];
  const db = await fakeBackend(page, base);

  await openRecords(page);
  await page.getByRole('button', { name: /2026년 10월 30일 .* 기록 수정/ }).click();
  const record = page.getByRole('dialog', { name: '기록 수정' });
  await record.getByLabel('메모').fill('장비 칸 없이 고침');
  await record.getByRole('button', { name: '저장' }).click();
  await expect(record).toBeHidden();
  expect(db.records!.find((row) => row.id === 'r00')).toMatchObject({ memo: '장비 칸 없이 고침', ...oldGear });

  await page.goto('./schedule?date=2026-11-07');
  await page.getByRole('button', { name: '새벽 출조 일정 수정' }).click();
  const event = page.getByRole('dialog', { name: '일정 수정' });
  await event.getByLabel('메모').fill('고친 일정');
  await event.getByRole('button', { name: '저장' }).click();
  await expect(event).toBeHidden();
  expect(db.events!.find((row) => row.id === 'e1')).toMatchObject({ memo: '고친 일정', gear_set_ids: ['set-1'] });
});

test('게스트: 보기만 되고 추가·수정·삭제 버튼과 알림 켜기가 보이지 않는다', async ({ page }) => {
  await fakeBackend(page, { ...seed(), members: [{ id: 'm-u1', user_id: 'u1', role: 'guest' }] });
  await page.goto('./schedule?date=2026-11-07');
  await expect(page.getByText('게스트로 보는 중입니다. 보기만 할 수 있습니다.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '새벽 출조' })).toBeVisible();
  await expect(page.getByRole('button', { name: '일정 추가', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /일정 수정|일정 삭제|기록 남기기|기록 수정/ })).toHaveCount(0);
  await page.goto('./');
  await expect(page.getByRole('button', { name: '장소 추가' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '무악재역', exact: true })).toBeVisible();
  await page.goto('./places/p1');
  await expect(page.getByRole('button', { name: /장소 수정|장소 삭제|기록 추가|기록 수정/ })).toHaveCount(0);
  await page.goto('./settings');
  await expect(page.getByText('게스트 계정은 알림을 켤 수 없습니다.')).toBeVisible();
  await expectAccessible(page);
});

test('지도: 핀은 지도에 올릴 때부터 핀 모양이고, 분류에 기타가 없다', async ({ page }) => {
  const base = seed();
  await fakeBackend(page, { ...base, places: [...base.places!, place('p9', '예전 기타 장소', 'etc')] });
  await page.goto('./');
  await expect(page.locator('.pin').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^예전 기타 장소 \(기타\) 선택/ })).toBeVisible(); // 예전에 기타로 저장한 장소도 핀은 남습니다.
  // 카카오 지도는 올리는 순간 핀 크기를 재어 기준점을 정합니다. 그때 핀 모양 클래스가 없으면 핀이 오른쪽 아래로 어긋납니다.
  const classes = await page.evaluate(() => (window as unknown as { __overlayClasses: string[] }).__overlayClasses);
  const pins = classes.filter((name) => name !== '' && !name.includes('map-popup'));
  expect(pins.length).toBeGreaterThan(0);
  for (const name of classes.filter((item) => !item.includes('pin-base'))) if (name) expect(name).toMatch(/\bpin pin-(fishing|restaurant|etc)\b/);
  const filters = page.getByRole('group', { name: '분류' });
  await expect(filters.getByRole('button')).toHaveText(['전체', '낚시', '맛집']);
});

test('도감: 탭마다 따로 찾고, 어종 카드는 빅원을 잡은 날로 간다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    fish_catches: [
      { id: 'f1', record_id: 'r00', angler: '김 조사', species: '감성돔', length_cm: 40, position: 0 },
      { id: 'f2', record_id: 'r03', angler: '류 조사', species: '볼락', length_cm: 22, position: 0 },
    ],
  });
  await page.goto('./dex');
  const fishSearch = page.getByRole('searchbox', { name: /어종 찾기/ });
  await fishSearch.fill('볼락');
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['볼락']);
  await expect(page.getByRole('button', { name: '어종 도감' })).toHaveCSS('font-weight', '700'); // 고른 탭은 굵게
  await page.getByRole('button', { name: '음식 도감' }).click();
  await expect(page.getByRole('searchbox', { name: /음식 찾기/ })).toHaveValue(''); // 음식 도감은 따로 찾습니다.
  await page.getByRole('button', { name: '어종 도감' }).click();
  await expect(fishSearch).toHaveValue('볼락');
  await fishSearch.fill('없는물고기');
  await expect(page.getByText("'없는물고기'에 맞는 어종이 없습니다.")).toBeVisible();
  await fishSearch.fill('');
  await page.getByRole('link', { name: /볼락/ }).click();
  await expect(page).toHaveURL(/\/schedule\?date=2026-10-27/);
});

test('기록 카드: n박 n일을 쓰지 않고, 잡은 물고기는 메모 아래에 둔다. 전체 기록에 건수를 쓰지 않는다', async ({ page }) => {
  const base = seed();
  base.records![0] = { ...base.records![0]!, end_date: '2026-10-31', memo: '바람이 셌음' };
  await fakeBackend(page, { ...base, fish_catches: [{ id: 'f1', record_id: 'r00', angler: '김 조사', species: '감성돔', length_cm: 40, position: 0 }] });
  await openRecords(page);
  const card = page.getByRole('article').filter({ hasText: '바람이 셌음' }).first();
  await expect(card).toBeVisible();
  const text = (await card.textContent()) ?? '';
  expect(text).not.toMatch(/\d+박 \d+일/);
  expect(text.indexOf('메모')).toBeLessThan(text.indexOf('잡은 물고기'));
  await expect(page.getByText(/건 표시 중/)).toHaveCount(0);
});

test('기록 폼: 전에 잡은 어종을 눌러 고른다', async ({ page }) => {
  await fakeBackend(page, { ...seed(), fish_catches: [{ id: 'f1', record_id: 'r00', angler: '김 조사', species: '감성돔', length_cm: 40, position: 0 }] });
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  await dialog.getByRole('button', { name: '물고기 추가' }).click();
  const fish = dialog.getByRole('group', { name: '물고기 1', exact: true });
  await fish.getByRole('group', { name: '물고기 1 전에 잡은 어종' }).getByRole('button', { name: '감성돔' }).click();
  await expect(fish.getByLabel('어종')).toHaveValue('감성돔');
  await expect(fish.getByRole('button', { name: '감성돔' })).toHaveAttribute('aria-pressed', 'true');
});

test('지도: 현재 위치 단추로 내 위치를 표시하고, 권한이 없으면 안내한다', async ({ page, context }) => {
  await fakeBackend(page, seed());
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 37.5, longitude: 127 });
  await page.goto('./');
  await page.getByRole('button', { name: '현재 위치로 이동' }).click();
  await expect(page.getByRole('img', { name: '내 위치' })).toBeAttached();
  await expect(page.getByRole('status').filter({ hasText: '지도를 현재 위치로 옮겼습니다.' })).toBeAttached();
  await expectAccessible(page);

  // 권한을 거두면 이유와 해결 방법을 알립니다.
  await context.clearPermissions();
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError);
  });
  await page.getByRole('button', { name: '현재 위치로 이동' }).click();
  await expect(page.getByRole('alert')).toContainText('위치 권한이 꺼져 있습니다');
  await page.waitForTimeout(5500);
  await expect(page.getByRole('alert')).toBeVisible(); // 저절로 사라지지 않습니다.
  await page.getByRole('button', { name: '위치 안내 닫기' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '현재 위치로 이동' })).toBeFocused(); // 닫은 뒤 초점이 길을 잃지 않습니다.
});

test('맛집 기록은 종료 날짜가 없고, 일정에는 시작 시간이 없다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./places/p2');
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  await expect(dialog.getByLabel('날짜', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('종료 날짜')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '음식 추가' })).toBeVisible();
  await dialog.getByLabel('날짜', { exact: true }).fill('2026-11-02');
  await dialog.getByLabel('음식 1', { exact: true }).fill('모둠회');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.records!.at(-1)).toMatchObject({ visited_on: '2026-11-02', end_date: '2026-11-02' });

  await page.goto('./schedule?date=2026-11-07');
  await expect(page.getByRole('heading', { name: '새벽 출조' })).toBeVisible();
  await expect(page.getByText('06:00')).toHaveCount(0);
  await page.getByRole('button', { name: '새벽 출조 일정 수정' }).click();
  await expect(page.getByRole('dialog', { name: '일정 수정' }).getByLabel('시작 시간')).toHaveCount(0);
});

test('통계: 자주 간 낚시 포인트·맛집을 누르면 장소 상세로 간다. 설정의 평점 대기는 없으면 감춘다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00+09:00'));
  await fakeBackend(page, seed());
  await page.goto('./stats');
  await page.getByRole('region', { name: '자주 간 낚시 포인트' }).getByRole('link', { name: /거문도 방파제/ }).click();
  await expect(page).toHaveURL(/\/places\/p1$/);
  // 평점 대기 조회가 끝난 뒤에도 칸이 없는지 봅니다(조회 중에도 칸을 그리지 않으므로).
  const pending = page.waitForResponse((response) => /\/rest\/v1\/records\?select=id%2C\+?visited_on%2C\+?angler_ratings/.test(response.url()));
  await page.goto('./settings');
  await pending;
  await expect(page.getByRole('region', { name: '알림', exact: true })).toBeVisible();
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(page.getByRole('region', { name: '평점 대기' })).toHaveCount(0);
});

test('휴대폰 일정: 날짜를 누르면 아래에서 일정 추가 알림창이 올라오고, 머리의 일정 추가는 감춘다. 지도 평점 안내는 여닫는다', async ({ page }, testInfo) => {
  await fakeBackend(page, seed());
  await page.goto('./schedule?date=2026-11-07');
  await expect(page.getByRole('heading', { name: '새벽 출조' })).toBeVisible();
  const head = page.getByRole('region', { name: /2026년 11월 7일/ }).getByRole('button', { name: '일정 추가', exact: true });
  await page.getByRole('button', { name: /^9 일 \(월\)/ }).click();
  const sheet = page.getByRole('region', { name: '고른 날 일정 추가' });
  if (testInfo.project.name === 'desktop') {
    await expect(sheet).toBeHidden(); // 넓은 화면은 머리의 단추를 씁니다.
  } else {
    // 휴대폰은 고른 날짜·공휴일 머리를 감춥니다(알림창과 겹침). 제목은 화면 읽기 프로그램에만 남깁니다.
    // 제목은 남아 있지만, 그 제목을 담은 머리가 1px로 잘려 화면에는 보이지 않습니다.
    const dayTitle = page.getByRole('heading', { name: '2026년 11월 9일 (월)' });
    await expect(dayTitle).toBeAttached();
    const clipped = await dayTitle.evaluate((node) => {
      for (let element: Element | null = node; element; element = element.parentElement) {
        const box = element.getBoundingClientRect();
        if (box.width <= 1 && box.height <= 1 && getComputedStyle(element).overflow === 'hidden') return true;
      }
      return false;
    });
    expect(clipped).toBe(true);
    await expect(head).toBeHidden();
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('11월 9일 (월)');
    // 알림창 높이만큼 아래를 더 비웁니다: 하단 탭 + 알림창 + 그 위로 올린 맨 위로 단추(44px)까지 가리지 않게.
    await sheet.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished))); // 올라오는 움직임이 끝난 뒤 잽니다.
    const space = await page.evaluate(() => {
      const main = document.querySelector('.main-area')!;
      const sheetBox = document.querySelector('.day-sheet')!.getBoundingClientRect();
      return { padding: parseFloat(getComputedStyle(main).paddingBottom), cover: innerHeight - sheetBox.top + 44 };
    });
    expect(space.padding).toBeGreaterThanOrEqual(space.cover);
    await expectAccessible(page);
    await sheet.getByRole('button', { name: '일정 추가', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '새 일정' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet.getByRole('button', { name: '일정 추가', exact: true })).toBeFocused(); // 창을 닫으면 알림창 단추로 돌아옵니다.
    await sheet.getByRole('button', { name: '일정 추가 알림창 닫기' }).click();
    await expect(sheet).toHaveCount(0);
    // 공휴일이면 알림창에 공휴일 이름도 씁니다.
    await page.goto('./schedule?date=2026-12-01');
    await page.getByRole('button', { name: /^25 일 \(금\), 2026년 12월, 성탄절/ }).click();
    await expect(sheet).toContainText('12월 25일 (금)');
    await expect(sheet).toContainText('성탄절');
  }

  await page.goto('./');
  const toggle = page.getByRole('button', { name: '평점', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#map-legend-scale')).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#map-legend-scale')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: '평점', exact: true })).toHaveAttribute('aria-expanded', 'false'); // 고른 상태를 기억합니다.
});

test('음식 도감: 가격이 바뀌면 지난번보다 오르내린 금액을 보여 준다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    records: [
      ...seed().records!,
      { id: 'm1', place_id: 'p2', visited_on: '2026-09-01', catches: '' },
      { id: 'm2', place_id: 'p2', visited_on: '2026-10-01', catches: '' },
      { id: 'm3', place_id: 'p2', visited_on: '2026-11-01', catches: '' },
    ],
    menu_items: [
      { id: 'a1', record_id: 'm1', name: '모둠회', price: 50000, position: 0 },
      { id: 'a2', record_id: 'm2', name: '모둠회', price: 50000, position: 0 },
      { id: 'a3', record_id: 'm3', name: '모둠회', price: 55000, position: 0 },
      { id: 'b1', record_id: 'm2', name: '매운탕', price: 20000, position: 1 },
      { id: 'b2', record_id: 'm3', name: '매운탕', price: 18000, position: 1 },
      { id: 'c1', record_id: 'm3', name: '전복죽', price: 15000, position: 2 },
    ],
  });
  await page.goto('./dex');
  await page.getByRole('button', { name: '음식 도감' }).click();
  const card = (name: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });
  await expect(card('모둠회')).toContainText('55,000원 (+5,000원)');
  await expect(card('매운탕')).toContainText('18,000원 (-2,000원)');
  await expect(card('전복죽')).toContainText('15,000원');
  await expect(card('전복죽')).not.toContainText('(+');
  // 좁아서 줄이 바뀌면 가격과 증감이 각각 통째로 나뉩니다.
  const pieces = card('모둠회').locator('dd span.whitespace-nowrap');
  await expect(pieces).toHaveText(['55,000원', '(+5,000원)']);
});

test('지도: 핀을 고르면 왼쪽 아래에 그곳의 날씨와 기온을 보여 준다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  await expect(page.locator('.weather-badge')).toHaveCount(0); // 고르기 전에는 없습니다.
  await page.getByRole('button', { name: /^거문도 방파제 \(낚시\) 선택/ }).click();
  const badge = page.locator('.weather-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('14°');
  await expect(badge).toContainText('구름'); // 기록의 날씨 선택지 이름을 씁니다.
  await expect(badge).toContainText('거문도 방파제 지금 날씨 구름, 기온 14도');
  await expectAccessible(page);
  // 무악재역도 같은 방식입니다.
  await page.getByRole('button', { name: '무악재역', exact: true }).click();
  await expect(badge).toContainText('무악재역 지금 날씨');
});

test('지도: 고른 장소를 지도에서 새 위치로 옮긴다(좌표는 보이지 않음)', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./');
  // 휴대폰은 위에 붙은 지도와 하단 탭 사이라 자동 스크롤이 가리므로 눌림 이벤트를 바로 보냅니다.
  await page.getByRole('list', { name: '장소 목록' }).getByRole('button', { name: /^거문도 방파제/ }).dispatchEvent('click');
  await page.getByRole('button', { name: '지도에서 위치 옮기기' }).dispatchEvent('click');
  await expect(page.getByText("지도에서 '거문도 방파제'의 새 위치를 눌러 주세요.")).toBeVisible();
  const box = (await page.getByTestId('map').boundingBox())!;
  await page.getByTestId('map').click({ position: { x: box.width * 0.75, y: box.height * 0.45 } });
  const dialog = page.getByRole('dialog', { name: '장소 수정' });
  await expect(dialog.getByLabel('이름')).toHaveValue('거문도 방파제');
  await expect(dialog.getByLabel('위도')).toHaveCount(0);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  const moved = db.places!.find((item) => item.id === 'p1')!;
  expect(moved.latitude).not.toBe(34.03); // 같은 장소(기록은 그대로)의 좌표만 바뀝니다.
  expect(db.places).toHaveLength(3);
});
