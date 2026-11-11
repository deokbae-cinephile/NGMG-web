// E2E: 지도·장소
import { expect, test } from '@playwright/test';
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

test('무악재역 버튼: 장소로 고르면 말풍선이 뜨고, 맨 위 단추(위치 지정·지도 확대·목록 확대·장소 추가·무악재역)가 한 줄에 놓이며, 길찾기 출발지가 된다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  const base = page.getByRole('button', { name: '무악재역', exact: true });
  await expect(base).toHaveAttribute('aria-pressed', 'false');
  const boxes = await Promise.all(
    [page.getByRole('button', { name: '위치 지정', exact: true }), page.getByRole('button', { name: '지도 확대' }), page.getByRole('button', { name: '목록 확대' }), page.getByRole('button', { name: '장소 추가' }), base].map((button) => button.boundingBox()),
  );
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
  await expect(filters.getByRole('button')).toHaveText(['전체', '낚시', '맛집', '숙박', '기타']); // 숙박·기타를 다시 더했습니다(사용자 요청).
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

test('지도: 위치 지정 중에는 키보드 사용자에게 장소 추가의 찾기를 안내한다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./');
  await page.getByRole('button', { name: '위치 지정', exact: true }).click();
  await expect(page.getByText("키보드로는 '장소 추가'에서 주소나 이름으로 찾아 추가할 수 있습니다.", { exact: false })).toBeVisible();
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
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '지도 작게' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '지도 확대' })).toBeFocused();
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

  // 목록 확대 중 위치 지정을 누르면 목록을 줄여 지도를 보여 줍니다.
  await page.getByRole('button', { name: '목록 확대' }).click();
  await page.getByRole('button', { name: '위치 지정', exact: true }).click();
  await expect(page.locator('.list-expanded')).toHaveCount(0);
});

test('장소: 분류에 숙박·기타가 있고, 맛집은 영업시간과 휴무 요일을 저장해 보여 준다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./');
  await expect(page.getByRole('group', { name: '분류' }).getByRole('button')).toHaveText(['전체', '낚시', '맛집', '숙박', '기타']);
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
