// E2E: 지도·장소
import { expect, test, type Locator } from '@playwright/test';
import { acceptDialogs, expectAccessible, expectFits, fakeBackend, LONG_NAME, place, seed } from './support';

acceptDialogs();

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
  // 목록의 긴 이름은 한 줄로 줄입니다(오른쪽 사진과 겹치지 않게).
  const title = page.getByRole('list', { name: '장소 목록' }).locator(`[title="${LONG_NAME}"]`);
  expect(await title.evaluate((node) => node.scrollWidth > node.clientWidth && getComputedStyle(node).textOverflow === 'ellipsis')).toBe(true);
  await page.goto('./places/p3');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectFits(page);
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
  await expect(page.getByRole('button', { name: '지도에서 위치 옮기기' })).toHaveCount(0); // 위치 옮기기 기능은 없앴습니다.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // 지도를 눌러 위치를 지정하면 위도·경도가 채워진 새 장소 창이 열립니다.
  await page.getByRole('button', { name: '위치 지정', exact: true }).click();
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

  await expect(page.getByRole('button', { name: /위성 지도|일반 지도/ })).toHaveCount(0); // 지도 종류 단추는 없앴습니다(사용자 요청).
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

test('지도 단추: 오른쪽에 위에서부터 지도 확대·위치 지정·무악재역·현재 위치가 틈 없이 붙고, 목록 위는 장소 추가(왼쪽 끝)·목록 확대(오른쪽 끝)다. 무악재역은 길찾기 출발지다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  const tools = page.getByRole('group', { name: '지도 단추' });
  const base = tools.getByRole('button', { name: '무악재역', exact: true });
  await expect(base).toHaveAttribute('aria-pressed', 'false');
  const column = await Promise.all(
    [tools.getByRole('button', { name: '지도 확대' }), tools.getByRole('button', { name: '위치 지정', exact: true }), base, page.getByRole('button', { name: '현재 위치로 이동' })].map((button) => button.boundingBox()),
  );
  for (let i = 1; i < column.length; i += 1) {
    expect(Math.round(column[i]!.x)).toBe(Math.round(column[0]!.x)); // 같은 세로줄
    expect(Math.round(column[i]!.y)).toBe(Math.round(column[i - 1]!.y + column[i - 1]!.height) - 1); // 틈 없이(선 1px 겹침) 아래로
  }
  // 키보드 이동 순서도 화면 위아래 순서와 같습니다.
  await tools.getByRole('button', { name: '지도 확대' }).focus();
  for (const name of ['위치 지정', '무악재역', '현재 위치로 이동']) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name, exact: true }).first()).toBeFocused();
  }
  // 목록 위: 장소 추가는 왼쪽 끝, 목록 확대는 오른쪽 끝
  const region = page.getByRole('region', { name: '내 장소' });
  const head = (await region.locator('.map-actions').boundingBox())!;
  const add = (await region.getByRole('button', { name: '장소 추가' }).boundingBox())!;
  const list = (await region.getByRole('button', { name: '목록 확대' }).boundingBox())!;
  expect(Math.round(add.x)).toBe(Math.round(head.x));
  expect(Math.round(list.x + list.width)).toBe(Math.round(head.x + head.width));
  // 위치 지정은 다시 누르면 취소합니다(켜짐은 aria-pressed).
  const pick = tools.getByRole('button', { name: '위치 지정', exact: true });
  await expect(pick).toHaveText('');
  await pick.click();
  await expect(pick).toHaveAttribute('aria-pressed', 'true');
  await pick.click();
  await expect(pick).toHaveAttribute('aria-pressed', 'false');
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

test('지도: 평균 5점 장소에도 색이 있다', async ({ page }) => {
  await fakeBackend(page, { ...seed(), records: [{ id: 'a', place_id: 'p1', visited_on: '2026-10-01', rating: 5 }] });
  await page.goto('./');
  await expect(page.getByRole('button', { name: /거문도 방파제 \(낚시\) 선택, 평균 평점 5\.0$/ })).toHaveClass(/rate-5/);
  await expect(page.getByRole('group', { name: /1점대부터 5점까지/ }).getByText('5', { exact: true })).toBeVisible();
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

test('지도: 핀은 지도에 올릴 때부터 핀 모양이고, 분류는 낚시·맛집·숙박·기타다', async ({ page }) => {
  const base = seed();
  await fakeBackend(page, { ...base, places: [...base.places!, place('p9', '예전 기타 장소', 'etc')] });
  await page.goto('./');
  await expect(page.locator('.pin').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^예전 기타 장소 \(기타\) 선택/ })).toBeVisible(); // 예전에 기타로 저장한 장소도 핀은 남습니다.
  // 카카오 지도는 올리는 순간 핀 크기를 재어 기준점을 정합니다. 그때 핀 모양 클래스가 없으면 핀이 오른쪽 아래로 어긋납니다.
  const classes = await page.evaluate(() => (window as unknown as { __overlayClasses: string[] }).__overlayClasses);
  const pins = classes.filter((name) => name !== '' && !name.includes('map-popup'));
  expect(pins.length).toBeGreaterThan(0);
  for (const name of classes.filter((item) => !item.includes('pin-base'))) if (name) expect(name).toMatch(/\bpin pin-(fishing|restaurant|lodging|etc)\b/);
  const filters = page.getByRole('group', { name: '분류' });
  await expect(filters.getByRole('button')).toHaveCount(5);
  expect(await filters.getByRole('button').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual(['전체', '낚시', '맛집', '숙박', '기타']); // 숙박·기타를 다시 더했습니다(사용자 요청).
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
  // 안내는 오른쪽 지도 단추 줄과 겹치지 않습니다(닫기 단추가 지도 확대 단추에 가리지 않게).
  const alertBox = (await page.getByRole('alert').boundingBox())!;
  const toolBox = (await page.getByRole('group', { name: '지도 단추' }).boundingBox())!;
  expect(alertBox.x + alertBox.width).toBeLessThanOrEqual(toolBox.x);
  await page.getByRole('button', { name: '위치 안내 닫기' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '현재 위치로 이동' })).toBeFocused(); // 닫은 뒤 초점이 길을 잃지 않습니다.
});

test('지도: 오른쪽 위 날씨 상자는 고른 핀의 날씨 아이콘과 기온만 보여 주고, 고르기 전에는 날씨 아이콘만 둔다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  const badge = page.locator('.weather-badge');
  // 고르기 전: 날씨 상징 아이콘만 있고 기온은 없습니다.
  await expect(badge).toBeVisible();
  await expect(badge.locator('svg')).toHaveCount(1);
  await expect(badge).not.toContainText('°');
  // 높이는 평점 안내와 같고 가로는 두 배입니다.
  const [legend, box] = [await page.locator('.map-legend').boundingBox(), await badge.boundingBox()];
  expect(Math.round(box!.height)).toBe(Math.round(legend!.height));
  expect(Math.round(box!.width)).toBe(Math.round(box!.height * 2));
  await page.getByRole('button', { name: /^거문도 방파제 \(낚시\) 선택/ }).click();
  await expect(badge).toContainText('14°');
  await expect(badge.locator('[aria-hidden="true"]').filter({ hasText: '구름' })).toHaveCount(0); // 날씨 이름은 화면에 쓰지 않습니다.
  await expect(badge).toContainText('거문도 방파제 지금 날씨 구름, 기온 14도'); // 화면 읽기 프로그램용 문장
  await expectAccessible(page);
  // 무악재역도 같은 방식입니다.
  await page.getByRole('button', { name: '무악재역', exact: true }).click();
  await expect(badge).toContainText('무악재역 지금 날씨');
});

test('지도 날씨: 고른 뒤 받기에 실패하면 그 장소의 날씨를 못 불러왔다고 알린다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ status: 500, body: '' }));
  await page.goto('./');
  // 날씨 안내는 상태 영역(role=status)이라 바뀌면 화면 읽기 프로그램이 알립니다.
  const badge = page.getByRole('status').filter({ hasText: '날씨' });
  await expect(badge).toContainText('장소를 고르면 그곳의 지금 날씨를 보여 줍니다.');
  await page.getByRole('button', { name: /^거문도 방파제 \(낚시\) 선택/ }).click();
  await expect(badge).toContainText('거문도 방파제의 날씨를 불러오지 못했습니다.', { timeout: 10000 });
  await expect(badge).not.toContainText('°');
});

test('지도 날씨: 모든 핀의 날씨를 한 번에 미리 받아, 핀마다 그곳 기온을 바로 보여 준다', async ({ page }) => {
  const base = seed();
  await fakeBackend(page, { ...base, places: [...base.places!, { ...place('p8', '북쪽 포인트'), latitude: 36.03 }] });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://api.open-meteo.com/')) requests.push(request.url());
  });
  await page.goto('./');
  await expect.poll(() => requests.length).toBe(1); // 한 번의 요청에 모든 핀(무악재역 포함)의 좌표를 담습니다.
  expect(new URL(requests[0]!).searchParams.get('latitude')!.split(',').length).toBeGreaterThanOrEqual(3);
  const badge = page.getByRole('status').filter({ hasText: '날씨' });
  await page.getByRole('button', { name: /^거문도 방파제 \(낚시\) 선택/ }).click();
  await expect(badge).toContainText('14°');
  await page.getByRole('button', { name: /^북쪽 포인트 \(낚시\) 선택/ }).click();
  await expect(badge).toContainText('18°'); // 장소마다 그곳의 기온(위도가 다르면 다름)
  await page.getByRole('button', { name: '무악재역', exact: true }).click();
  await expect(badge).toContainText('21°');
  expect(requests).toHaveLength(1); // 핀을 눌러도 다시 받지 않습니다(미리 받은 값).
});

test('장소 추가 창: 폼 코드를 받지 못하면(오프라인 등) 앱 전체가 아니라 창 안에서 알리고, 창은 닫을 수 있다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.route(/\/assets\/place-form-[^/]+\.js$/, (route) => route.abort());
  await page.goto('./');
  await page.getByRole('button', { name: '장소 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 장소' });
  await expect(dialog.getByRole('alert')).toContainText('창 내용을 불러오지 못했습니다.');
  await expect(page.getByRole('heading', { name: '내 장소 지도' })).toBeAttached(); // 지도 화면은 그대로입니다.
  await dialog.getByRole('button', { name: '닫기' }).click();
  await expect(dialog).toBeHidden();
});

test('지도: 확대한 지도에서도 위치를 지정하고, 고르면 지도를 줄여 새 장소 창을 연다. 위치 지정 안내 문구는 없다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./');
  await expect(page.locator('.pin').first()).toBeVisible();
  await page.getByRole('button', { name: '위치 지정', exact: true }).click();
  await expect(page.getByText(/지도에서 저장할 위치|키보드로는/)).toHaveCount(0); // 안내 문구는 사용자 요청으로 뺐습니다.
  await page.getByRole('button', { name: '위치 지정', exact: true }).click();

  await page.getByRole('button', { name: '지도 확대' }).click();
  const pick = page.getByRole('group', { name: '지도 단추' }).getByRole('button', { name: '위치 지정', exact: true });
  await expect(pick).toBeVisible();
  await pick.click();
  await expect(pick).toHaveAttribute('aria-pressed', 'true');
  const box = (await page.getByTestId('map').boundingBox())!;
  await page.getByTestId('map').click({ position: { x: box.width * 0.75, y: box.height * 0.45 } });
  const dialog = page.getByRole('dialog', { name: '새 장소' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: '지도 작게' })).toHaveCount(0); // 지도를 줄이고 창을 엽니다.
  await dialog.getByLabel('이름').fill('확대 지도 포인트');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.places!.some((item) => item.name === '확대 지도 포인트')).toBe(true);

  // 주소를 찾는 동안 지도를 줄여도 새 장소 창은 열립니다.
  await page.evaluate(() => {
    // 가짜 지도의 주소 찾기를 붙잡아 두었다가 window.releaseAddress()로 끝냅니다.
    const w = window as unknown as { kakao: { maps: { services: { Geocoder: { prototype: { coord2Address: (...args: unknown[]) => void } } } } }; releaseAddress: () => void };
    const proto = w.kakao.maps.services.Geocoder.prototype;
    const original = proto.coord2Address;
    proto.coord2Address = function (this: unknown, ...args: unknown[]) {
      w.releaseAddress = () => original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '지도 확대' }).click();
  await pick.click();
  await expect(pick).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('map').click({ position: { x: box.width * 0.3, y: box.height * 0.7 } }); // 방금 저장한 핀이 없는 자리
  await page.getByRole('button', { name: '지도 작게' }).click();
  await expect(page.getByRole('button', { name: '지도 작게' })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { releaseAddress: () => void }).releaseAddress());
  await expect(page.getByRole('dialog', { name: '새 장소' })).toBeVisible();
});

test('맛집: 오늘이 휴무 요일이면 목록·말풍선·상세에 오늘 휴무를 띄운다', async ({ page }) => {
  const base = seed();
  const today = new Date().getDay();
  base.places = base.places!.map((item) => (item.id === 'p2' ? { ...item, closed_days: [today] } : item.id === 'p1' ? { ...item, closed_days: [(today + 1) % 7] } : item));
  await fakeBackend(page, base);
  await page.goto('./');
  const list = page.getByRole('list', { name: '장소 목록' });
  await expect(list.getByRole('listitem').filter({ hasText: '바다횟집' }).getByText('오늘 휴무')).toBeVisible();
  await expect(list.getByRole('listitem').filter({ hasText: '거문도 방파제' }).getByText('오늘 휴무')).toHaveCount(0);
  await list.getByRole('button', { name: /^바다횟집/ }).click();
  await expect(page.getByRole('group', { name: '바다횟집 정보' }).getByText('오늘 휴무')).toBeVisible();
  await page.goto('./places/p2');
  await expect(page.getByText('오늘 휴무')).toBeVisible();
  await expectAccessible(page);
});

test('지도: 지도 확대는 지도를 화면 전체로, 목록 확대는 목록이 지도 위를 채우고, 작게 단추나 Esc로 돌아온다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  await expect(page.locator('.pin').first()).toBeVisible();
  const viewport = page.viewportSize()!;
  await page.getByRole('button', { name: '지도 확대' }).click();
  const map = page.getByRole('region', { name: '장소 지도' });
  await expect.poll(async () => Math.round((await map.boundingBox())!.height)).toBe(viewport.height);
  await expect(page.getByRole('button', { name: '지도 작게' })).toBeFocused();
  // 지도 작게 단추가 머리글·하단 메뉴에 가리지 않고 눌립니다(가려지면 click이 실패합니다).
  await page.getByRole('button', { name: '지도 작게' }).click({ timeout: 3000 });
  await expect(page.getByRole('button', { name: '지도 작게' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '지도 확대' })).toBeFocused();
  await expect.poll(async () => Math.round((await map.boundingBox())!.height)).toBeLessThan(viewport.height);
  await page.getByRole('button', { name: '지도 확대' }).click();
  // 확대한 지도가 머리글과 하단 메뉴까지 덮습니다. inert는 elementFromPoint에서 건너뛰므로 잠시 풀고 실제로 그려진 맨 위 요소를 봅니다.
  const covered = async (target: Locator) =>
    target.evaluate((element) => {
      const blocked = [...document.querySelectorAll('[inert]')];
      blocked.forEach((node) => node.removeAttribute('inert'));
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      blocked.forEach((node) => node.setAttribute('inert', ''));
      return Boolean(hit?.closest('.map-expanded'));
    });
  expect(await covered(page.getByRole('navigation', { name: '주요 메뉴' }))).toBe(true);
  expect(await covered(page.getByRole('banner'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '지도 작게' })).toHaveCount(0);
  expect((await map.boundingBox())!.height).toBeLessThan(viewport.height);

  await page.getByRole('button', { name: '목록 확대' }).click();
  const list = page.getByRole('list', { name: '장소 목록' });
  await expect(page.getByRole('button', { name: '목록 작게' })).toBeFocused();
  const pane = page.locator('.list-expanded');
  await expect.poll(async () => Math.round((await pane.boundingBox())!.height)).toBe(viewport.height);
  await expect(list).toBeVisible();
  await expectAccessible(page);
  // 목록에서 장소를 고르면 목록을 줄이고 지도에서 그 장소를 보여 줍니다.
  await list.getByRole('button', { name: /^거문도 방파제/ }).click();
  await expect(page.locator('.list-expanded')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '목록 확대' })).not.toBeFocused(); // 다른 작업으로 넘어갈 때는 초점을 돌리지 않습니다.
  const popup = page.getByRole('group', { name: '거문도 방파제 정보' });
  await expect(popup).toBeVisible();

  // 확대 중 Esc는 확대만 닫고 고른 장소는 그대로 둡니다. Tab 초점은 확대 화면 밖(가려진 단추)으로 나가지 않습니다.
  await page.getByRole('button', { name: '지도 확대' }).click();
  await expect(page.getByRole('button', { name: '지도 작게' })).toBeFocused();
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.map-expanded')) || document.activeElement === document.body)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.map-expanded')).toHaveCount(0);
  await expect(popup).toBeVisible();
  await expect(page.locator('[inert]')).toHaveCount(0);

  // 지도 확대 단추는 확대한 뒤에도 같은 자리에서 '지도 작게'로 바뀝니다(토글).
  const toggle = page.getByRole('group', { name: '지도 단추' }).getByRole('button', { name: '지도 확대' });
  const before = (await toggle.boundingBox())!;
  await toggle.click();
  const shrink = page.getByRole('group', { name: '지도 단추' }).getByRole('button', { name: '지도 작게' });
  const after = (await shrink.boundingBox())!;
  const mapBox = (await map.boundingBox())!;
  // 지도 칸 안에서 오른쪽·아래로부터 같은 거리에 있습니다.
  expect(Math.round(mapBox.x + mapBox.width - (after.x + after.width))).toBe(12);
  expect(Math.round(before.width)).toBe(Math.round(after.width));
  await shrink.click();
  await expect(page.getByRole('group', { name: '지도 단추' }).getByRole('button', { name: '지도 확대' })).toBeVisible();
});

test('장소: 분류에 숙박·기타가 있고, 맛집은 영업시간과 휴무 요일을 저장해 보여 준다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./');
  await expect(page.getByRole('group', { name: '분류' }).getByRole('button')).toHaveCount(5);
  expect(await page.getByRole('group', { name: '분류' }).getByRole('button').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual(['전체', '낚시', '맛집', '숙박', '기타']);
  await page.goto('./places/p2');
  await page.getByRole('button', { name: '장소 수정' }).click();
  const dialog = page.getByRole('dialog', { name: '장소 수정' });
  await expect(dialog.getByRole('radio', { name: '숙박' })).toBeVisible();
  await dialog.getByLabel('여는 시각').fill('11:00');
  await dialog.getByLabel('닫는 시각').fill('21:30');
  await dialog.getByRole('group', { name: '휴무 요일' }).getByLabel('월').check();
  await dialog.getByRole('group', { name: '휴무 요일' }).getByLabel('화').check();
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.places!.find((item) => item.id === 'p2')).toMatchObject({ open_time: '11:00', close_time: '21:30', closed_days: [1, 2] });
  await expect(page.getByText('11:00–21:30 · 월·화 휴무')).toBeVisible();
  // 낚시 장소에는 영업 정보 칸이 없습니다.
  await page.goto('./places/p1');
  await page.getByRole('button', { name: '장소 수정' }).click();
  await expect(page.getByRole('dialog', { name: '장소 수정' }).getByLabel('여는 시각')).toHaveCount(0);
});

test('지도: 확대 중 뒤로 가기는 다른 화면으로 가지 않고 확대만 닫는다. 작게 단추로 닫으면 뒤로 가기는 원래대로 이전 화면이다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./stats');
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '지도' }).click();
  await expect(page).toHaveTitle('지도 | 낚고먹고');
  for (const [open, shrink] of [['지도 확대', '지도 작게'], ['목록 확대', '목록 작게']] as const) {
    const shrinkButton = page.getByRole('button', { name: shrink });
    await page.getByRole('button', { name: open }).click();
    await expect(shrinkButton).toBeVisible();
    await page.goBack();
    await expect(shrinkButton).toHaveCount(0);
    await expect(page).toHaveTitle('지도 | 낚고먹고');
    // 앞으로 가기는 확대를 다시 열고, 다시 뒤로 가면 닫습니다.
    await page.goForward();
    await expect(shrinkButton).toBeVisible();
    await page.goBack();
    await expect(shrinkButton).toHaveCount(0);
  }
  // 목록 확대에서 장소를 빠르게 두 번 눌러도 뒤로 가기는 한 번만 보내 지도 화면에 남습니다.
  await page.getByRole('button', { name: '목록 확대' }).click();
  await page.getByRole('list', { name: '장소 목록' }).getByRole('button', { name: /^거문도 방파제/ }).evaluate((button: HTMLElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole('button', { name: '목록 작게' })).toHaveCount(0);
  await expect(page).toHaveTitle('지도 | 낚고먹고');
  await page.waitForTimeout(300);
  await expect(page).toHaveTitle('지도 | 낚고먹고');
  // 작게 단추로 닫으면 쌓은 기록도 지워, 뒤로 가기 한 번에 이전 화면(통계)으로 갑니다.
  await page.getByRole('button', { name: '지도 확대' }).click();
  await page.getByRole('button', { name: '지도 작게' }).click();
  await expect(page.getByRole('button', { name: '지도 작게' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '지도 확대' })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveTitle('통계 | 낚고먹고');
});

test('지도: 분류 필터는 아이콘 단추를 붙여 한 덩어리로 놓는다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  const group = page.getByRole('group', { name: '분류' });
  const buttons = group.getByRole('button');
  await expect(buttons).toHaveCount(5);
  for (const name of ['전체', '낚시', '맛집', '숙박', '기타']) await expect(group.getByRole('button', { name, exact: true })).toHaveText('');
  const boxes = await buttons.evaluateAll((items) => items.map((item) => item.getBoundingClientRect()));
  boxes.slice(1).forEach((box, index) => expect(Math.round(box.left)).toBe(Math.round(boxes[index]!.right) - 1)); // 선 1px을 겹쳐 붙임
  await group.getByRole('button', { name: '맛집' }).click();
  await expect(group.getByRole('button', { name: '맛집' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('list', { name: '장소 목록' }).getByRole('listitem')).toHaveCount(1);
});

test('분류 필터: 터치 화면에서도 알 수 있게 고른 분류 이름을 글자로 보여 준다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  const group = page.getByRole('group', { name: '분류', exact: true });
  await expect(group.locator('legend')).toHaveText('분류 · 전체');
  await group.getByRole('button', { name: '기타' }).click();
  await expect(group.locator('legend')).toHaveText('분류 · 기타');
});

test('지도를 불러오지 못해도 지도 단추(지도 작게 등)는 남아 확대를 닫을 수 있다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.route('https://dapi.kakao.com/**', (route) => route.abort());
  await page.goto('./');
  await expect(page.getByRole('alert').filter({ hasText: '지도를 불러오지 못했습니다' })).toBeVisible();
  const tools = page.getByRole('group', { name: '지도 단추' });
  await tools.getByRole('button', { name: '지도 확대' }).click();
  await expect(tools.getByRole('button', { name: '지도 작게' })).toBeVisible();
  await tools.getByRole('button', { name: '지도 작게' }).click();
  await expect(tools.getByRole('button', { name: '지도 확대' })).toBeVisible();
});
