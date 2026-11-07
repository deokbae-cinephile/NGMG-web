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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
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
  await expect(page.getByRole('heading', { name: '내 장소' })).toBeVisible();
});

test('지도: 검색으로 장소를 추가하고 필터를 기억한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./');
  await expect(page.getByRole('button', { name: '거문도 방파제 선택' })).toBeVisible();
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

  await page.getByLabel('내 장소에서 찾기').fill('거문도');
  await expect(page.getByRole('status').last()).toHaveText('장소 1곳');
  await page.getByLabel('내 장소에서 찾기').clear();

  await page.getByRole('button', { name: '맛집', exact: true }).click();
  await expect(page.getByRole('button', { name: '거문도 방파제 선택' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: '맛집', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('지도: 위치 지정 모드에서 누른 곳으로 새 장소를 만든다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  await page.getByRole('button', { name: '지도를 눌러 위치 지정' }).click();
  await page.getByTestId('map').click({ position: { x: 5, y: 5 } });
  const dialog = page.getByRole('dialog', { name: '새 장소' });
  await expect(dialog.getByLabel('위도')).toHaveValue(/^3\d\.\d+/);
  await expect(dialog.getByLabel('주소')).toHaveValue('전남 고흥군');
});

test('장소: 수정하고 삭제한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./places/p2');
  await expect(page.getByRole('heading', { name: '바다횟집' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: '푸른바다횟집' })).toBeVisible();

  await page.getByRole('button', { name: '장소 삭제' }).click();
  await expect(page.getByRole('heading', { name: '내 장소' })).toBeVisible();
  expect(db.places!.map((item) => item.id)).not.toContain('p2');
});

test('장소: 삭제하면 기록의 사진 파일도 지운다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '장소 삭제' }).click();
  await expect(page.getByRole('heading', { name: '내 장소' })).toBeVisible();
  expect(db.removedFiles).toEqual(['r00/1.jpg']);
  expect(db.events![0]!.place_id).toBeNull();
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

test('장소: Kakao를 불러오지 못해도 목록은 쓸 수 있다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.route('https://dapi.kakao.com/**', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('지도를 불러오지 못했습니다');
  await expect(page.getByRole('button', { name: /바다횟집/ })).toBeVisible();
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

test('기록: 수정해서 사진을 지우고 기록을 삭제한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '기록 수정' }).first().click();
  const dialog = page.getByRole('dialog', { name: '기록 수정' });
  await dialog.getByLabel('조과').fill('수정한 조과');
  await dialog.getByRole('checkbox', { name: '사진 1 삭제' }).check();
  await expectAccessible(page);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('수정한 조과')).toBeVisible();
  expect(db.record_photos).toHaveLength(0);
  expect(db.removedFiles).toEqual(['r00/1.jpg']);

  await page.getByRole('button', { name: '기록 수정' }).first().click();
  await dialog.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('수정한 조과')).toBeHidden();
  expect(db.records).toHaveLength(24);
});

test('기록: 분류로 거르고 선택을 기억한다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    records: [
      { id: 'a', place_id: 'p1', visited_on: '2026-10-02', catches: '볼락', memo: '', rating: null },
      { id: 'b', place_id: 'p2', visited_on: '2026-10-01', catches: '', memo: '물회', rating: null },
    ],
    record_photos: [],
  });
  await page.goto('./records');
  await expect(page.getByText('볼락')).toBeVisible();
  await page.getByRole('button', { name: '맛집', exact: true }).click();
  await expect(page.getByText('물회')).toBeVisible();
  await expect(page.getByText('볼락')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: '맛집', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('기록: 스크롤하면 다음 페이지를 불러온다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./records');
  const status = page.getByRole('status').first();
  await expect(page.getByText('감성돔 1마리')).toBeVisible();
  await expect(page.getByRole('img', { name: /기록 사진 1/ })).toHaveJSProperty('complete', true);
  expect(await page.getByRole('img', { name: /기록 사진 1/ }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expectFits(page);
  await expectAccessible(page);
  await page.getByRole('button', { name: '기록 더 불러오기' }).scrollIntoViewIfNeeded();
  await expect(status).toContainText(/기록 (20|25)건/);
  await page.mouse.wheel(0, 100000);
  await expect(page.getByText('감성돔 25마리')).toBeAttached();
  await expect(status).toHaveText('기록 25건 표시 중');
  await expect(page.getByRole('button', { name: '기록 더 불러오기' })).toBeHidden();
});

test('캘린더: 날짜를 눌러 장소가 붙은 일정을 만들고 삭제한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./calendar?date=2026-11-07');
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

test('캘린더: 날짜별 준비물을 불러와 체크하고 추가한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./calendar?date=2026-11-07');
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

test('캘린더: 이전 준비물을 복사하고 체크를 모두 해제한다', async ({ page }) => {
  const db = await fakeBackend(page, {
    ...seed(),
    checklist_items: [{ id: 'c1', date: '2026-10-01', title: '우비', category: '기타', checked: true, position: 0 }],
  });
  await page.goto('./calendar?date=2026-11-07');
  await page.getByRole('button', { name: '이전 목록 복사' }).click();
  const copied = page.getByRole('checkbox', { name: '우비' });
  await expect(copied).not.toBeChecked();
  await copied.click();
  await page.getByRole('button', { name: '체크 모두 해제' }).click();
  await expect(copied).not.toBeChecked();
  expect(db.checklist_items!.find((item) => item.date === '2026-10-01')).toMatchObject({ checked: true });
});

test('캘린더: 복사할 준비물이 없으면 알린다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./calendar?date=2026-11-07');
  await page.getByRole('button', { name: '이전 목록 복사' }).click();
  await expect(page.getByRole('alert')).toContainText('복사할 이전 목록이 없습니다');
});

test('캘린더: 물때를 보여 주고 일정에서 기록을 남긴다', async ({ page }) => {
  const db = await fakeBackend(page, {
    ...seed(),
    events: [{ id: 'e1', date: '2020-01-15', start_time: '06:00:00', end_time: null, title: '새벽 출조', place_id: 'p1', memo: '' }],
  });
  await page.goto('./calendar?date=2020-01-15');
  const conditions = page.getByRole('region', { name: '거문도 방파제 물때와 날씨' });
  await expect(conditions).toContainText('8물때식');
  await expect(conditions).toContainText('날씨 예보는');
  await expectFits(page);

  await page.getByRole('button', { name: '새벽 출조 기록 남기기' }).click();
  const dialog = page.getByRole('dialog', { name: '거문도 방파제 기록' });
  await expect(dialog.getByLabel('날짜')).toHaveValue('2020-01-15');
  await dialog.getByLabel('조과').fill('일정에서 남긴 기록');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.records!.at(-1)).toMatchObject({ place_id: 'p1', visited_on: '2020-01-15' });
});

test('캘린더: 다가오는 일정과 오늘 버튼으로 날짜를 옮기고 날씨를 보여 준다', async ({ page }) => {
  const soon = new Date(Date.now() + 2 * 86400000);
  const key = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
  await fakeBackend(page, {
    ...seed(),
    events: [{ id: 'e2', date: key, start_time: '07:00:00', end_time: null, title: '다음 출조', place_id: 'p1', memo: '' }],
  });
  await page.goto('./calendar?date=2020-01-15');
  await expect(page.getByRole('heading', { name: '2020년 1월 15일 (수)' })).toBeVisible();
  await page.getByRole('button', { name: /다음 출조/ }).click();
  await expect(page.getByRole('heading', { name: '다음 출조' })).toBeVisible();
  await expect(page.getByRole('region', { name: /물때와 날씨/ })).toContainText('4.2m/s');
  await expect(page.getByRole('region', { name: /물때와 날씨/ })).toContainText('0.5m');
  await expectAccessible(page);

  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
});

test('캘린더: 주소의 날짜가 잘못되어도 화면이 깨지지 않는다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./calendar?date=abc');
  await expect(page.getByRole('heading', { name: '캘린더' })).toBeVisible();
});

test('계정: 비밀번호를 바꾼다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  await page.getByRole('button', { name: '비밀번호 변경' }).click();
  const dialog = page.getByRole('dialog', { name: '비밀번호 변경' });
  await dialog.getByLabel('새 비밀번호', { exact: true }).fill('short');
  await dialog.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(dialog.getByText('8자 이상 입력해 주세요.').last()).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);

  await dialog.getByLabel('새 비밀번호', { exact: true }).fill('same-password');
  await dialog.getByLabel('새 비밀번호 확인').fill('other-password');
  await dialog.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(dialog.getByText('비밀번호가 서로 다릅니다.')).toBeVisible();
  await dialog.getByLabel('새 비밀번호 확인').fill('same-password');
  await dialog.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(dialog.getByRole('alert')).toContainText('비밀번호를 바꾸지 못했습니다');

  await dialog.getByLabel('새 비밀번호', { exact: true }).fill('new-password');
  await dialog.getByLabel('새 비밀번호 확인').fill('new-password');
  await dialog.getByRole('button', { name: '비밀번호 변경' }).click();
  await expect(dialog).toBeHidden();
});

test('키보드: 본문 바로가기와 메뉴 이동이 동작한다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./calendar');
  await expect(page.getByRole('heading', { name: '캘린더' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문 바로가기' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.getByRole('link', { name: '기록' }).click();
  await expect(page).toHaveTitle('기록 | 낚고먹고');
  await expect(page.locator('#main')).toBeFocused();
});

test('로그인: 서버에 닿지 못하면 비밀번호 오류로 안내하지 않는다', async ({ page }) => {
  await fakeBackend(page, seed(), { signedIn: false });
  await page.route('**/auth/v1/token**', (route) => route.abort());
  await page.goto('./');
  await page.getByLabel('이메일').fill('a@example.com');
  await page.getByLabel('비밀번호').fill('secret');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('alert')).toContainText('잠시 후 다시 시도');
});

test('장소: 삭제에 실패하면 사진 파일을 지우지 않는다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.route('**/rest/v1/places**', (route) =>
    route.request().method() === 'DELETE' ? route.fulfill({ status: 500, json: { message: 'fail' } }) : route.fallback(),
  );
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '장소 삭제' }).click();
  await expect(page.getByRole('alert')).toContainText('장소를 삭제하지 못했습니다');
  expect(db.removedFiles).toEqual([]);
});

test('캘린더: 일정의 날짜를 옮기면 옮긴 날을 보여 준다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./calendar?date=2026-11-07');
  await page.getByRole('button', { name: '새벽 출조 일정 수정' }).click();
  const dialog = page.getByRole('dialog', { name: '일정 수정' });
  await dialog.getByLabel('날짜').fill('2026-11-10');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: '2026년 11월 10일 (화)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '새벽 출조' })).toBeVisible();
  expect(db.events![0]).toMatchObject({ date: '2026-11-10' });
});

test('캘린더: 준비물 오류는 다음 동작이 성공하거나 날짜를 옮기면 사라진다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./calendar?date=2026-11-09');
  await page.getByRole('button', { name: '이전 목록 복사' }).click();
  await expect(page.getByRole('alert')).toContainText('복사할 이전 목록이 없습니다');
  await page.getByRole('button', { name: '10 일 (화), 2026년 11월' }).click();
  await expect(page.getByRole('heading', { name: '2026년 11월 10일 (화)' })).toBeVisible();
  await expect(page.getByRole('alert')).toBeHidden();
  await page.getByRole('button', { name: '이전 목록 복사' }).click();
  await expect(page.getByRole('alert')).toContainText('복사할 이전 목록이 없습니다');
  await page.getByRole('button', { name: '기본 목록 불러오기' }).click();
  await expect(page.getByRole('checkbox').first()).toBeVisible();
  await expect(page.getByRole('alert')).toBeHidden();
});

test('없는 주소: 제목을 보여 준다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./nowhere');
  await expect(page.getByRole('heading', { level: 1, name: '페이지를 찾을 수 없습니다' })).toBeVisible();
  await expect(page).toHaveTitle('페이지 없음 | 낚고먹고');
});

test('기록: 조과와 메모에서 찾고 지우면 전체를 보여 준다', async ({ page }) => {
  await fakeBackend(page, {
    ...seed(),
    records: [
      { id: 'a', place_id: 'p1', visited_on: '2026-10-02', catches: '볼락', memo: '', rating: null },
      { id: 'b', place_id: 'p2', visited_on: '2026-10-01', catches: '', memo: '물회가 맛있다', rating: null },
    ],
    record_photos: [],
  });
  await page.goto('./records');
  await expect(page.getByText('볼락')).toBeVisible();
  await expectAccessible(page);
  const search = page.getByRole('searchbox', { name: '조과·메모에서 찾기' });
  await search.fill('물회');
  await search.press('Enter');
  await expect(page.getByText('물회가 맛있다')).toBeVisible();
  await expect(page.getByText('볼락')).toBeHidden();
  await search.fill('없는말');
  await page.getByRole('button', { name: '찾기' }).click();
  await expect(page.getByText(/없는말.*기록이 없습니다/)).toBeVisible();
  await search.fill('');
  await expect(page.getByText('볼락')).toBeVisible();
});

test('기록: 데이터를 JSON 파일로 백업한다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./records');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '데이터 백업' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^ngmg-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk as Buffer);
  const { tables } = JSON.parse(Buffer.concat(chunks).toString());
  expect(tables.places).toHaveLength(3);
  expect(tables.records).toHaveLength(25);
  expect(tables.events).toHaveLength(1);
  await expect(page.getByText('백업 파일을 저장했습니다.')).toBeVisible();
});

test('장소: 기록 요약을 보여 준다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./places/p1');
  await expect(page.getByText('25건')).toBeVisible();
  await expect(page.getByText('4.0점')).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: '2026년 10월 30일' })).toBeVisible();
  await expectFits(page);
  await expectAccessible(page);
});

test('지도: 현재 위치에서 가까운 순으로 정렬하고 끌 수 있다', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 34.74, longitude: 127.74 });
  await fakeBackend(page, {
    places: [
      { ...place('far', '가장 먼 방파제'), latitude: 37.5, longitude: 129.1 },
      { ...place('near', '바로 앞 횟집', 'restaurant'), latitude: 34.75, longitude: 127.75 },
    ],
  });
  await page.goto('./');
  const names = page.getByRole('main').getByRole('listitem').getByRole('button');
  await expect(names.first()).toContainText('가장 먼 방파제');
  const sort = page.getByRole('button', { name: '현재 위치에서 가까운 순' });
  await sort.click();
  await expect(sort).toHaveAttribute('aria-pressed', 'true');
  await expect(names.first()).toContainText('바로 앞 횟집');
  await expect(names.first()).toContainText(/직선거리 \d+(\.\d)?(m|km)/);
  await expectFits(page);
  await sort.click();
  await expect(sort).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(/직선거리/)).toHaveCount(0);
  await expect(names.first()).toContainText('가장 먼 방파제');
});

test('지도: 위치 권한이 없으면 이유를 알린다', async ({ page, context }) => {
  await context.clearPermissions();
  await fakeBackend(page, seed());
  await page.goto('./');
  await page.getByRole('button', { name: '현재 위치에서 가까운 순' }).click();
  await expect(page.getByRole('alert')).toContainText('위치 권한');
});

test('대화상자: 입력한 뒤 닫으면 묻는다', async ({ page }) => {
  const messages: string[] = [];
  page.on('dialog', (dialog) => void messages.push(dialog.message()));
  await fakeBackend(page, seed());
  await page.goto('./calendar?date=2026-11-07');
  await page.getByRole('button', { name: '일정 추가' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(messages).toEqual([]);
  await page.getByRole('button', { name: '일정 추가' }).click();
  await page.getByRole('dialog').getByLabel('할 일').fill('점심');
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(messages).toEqual(['작성 중인 내용을 버리고 닫을까요?']);
});
