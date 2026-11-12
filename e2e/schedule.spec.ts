// E2E: 일정·달력
import { expect, test, type Locator } from '@playwright/test';
import { acceptDialogs, expectAccessible, expectFits, fakeBackend, place, seed } from './support';

acceptDialogs();

test('일정: 날짜를 눌러 장소가 붙은 일정을 만들고 삭제한다. 새 일정은 챙길 물품을 하나 이상 골라야 저장된다', async ({ page }, testInfo) => {
  const db = await fakeBackend(page, { ...seed(), angler_gear: [{ id: 'g1', angler: '김 조사', category: '로드', brand: '다이와', name: '레가리스' }] });
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
  // 새 일정은 챙길 물품이 열려 있고, 하나도 고르지 않으면 저장하지 않고 안내합니다.
  await expect(dialog.getByRole('button', { name: /챙길 물품/ })).toHaveAttribute('aria-expanded', 'true');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('챙길 물품을 하나 이상 골라 주세요.')).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: /레가리스/ })).toBeFocused();
  // 머리 단추로 여닫습니다.
  await dialog.getByRole('button', { name: /챙길 물품/ }).click();
  await expect(dialog.getByRole('checkbox', { name: /레가리스/ })).toBeHidden();
  await dialog.getByRole('button', { name: /챙길 물품/ }).click();
  await dialog.getByRole('checkbox', { name: /레가리스/ }).check();
  await expect(dialog.getByText('챙길 물품을 하나 이상 골라 주세요.')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '챙길 물품 (1개 고름)' })).toBeVisible();
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

test('휴대폰 일정: 날짜를 누르면 아래에서 일정 추가 알림창이 올라오고, 머리의 일정 추가는 감춘다', async ({ page }, testInfo) => {
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

});

test('휴대폰 게스트: 날짜 알림창에 날짜·공휴일은 보이고 일정 추가 단추는 없다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop');
  await fakeBackend(page, { ...seed(), members: [{ id: 'm-u1', user_id: 'u1', role: 'guest' }] });
  await page.goto('./schedule?date=2026-12-01');
  await page.getByRole('button', { name: /^25 일 \(금\), 2026년 12월, 성탄절/ }).click();
  const sheet = page.getByRole('region', { name: '고른 날 일정 추가' });
  await expect(sheet).toContainText('12월 25일 (금)');
  await expect(sheet).toContainText('성탄절');
  await expect(page.getByText(/게스트로 보는 중/)).toBeVisible(); // 역할을 확인한 뒤에 단추가 없는지 봅니다(확인 중에도 단추는 감춰져 있으므로).
  await expect(sheet.getByRole('button', { name: '일정 추가', exact: true })).toHaveCount(0);
});

test('휴대폰 일정: 들어오면 오늘(고른 날) 알림창이 처음부터 열려 있다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop');
  await fakeBackend(page, seed());
  await page.goto('./schedule');
  const sheet = page.getByRole('region', { name: '고른 날 일정 추가' });
  await expect(sheet).toBeVisible();
  const today = new Date();
  await expect(sheet).toContainText(`${today.getMonth() + 1}월 ${today.getDate()}일`);
});

test('일정·기록 목록: 수정 단추는 휴대폰에서도 각 항목의 오른쪽 위에 있다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./schedule?date=2026-11-07');
  const check = async (button: Locator, item: Locator) => {
    const [b, box] = [(await button.boundingBox())!, (await item.boundingBox())!];
    expect(Math.round(box.x + box.width - (b.x + b.width))).toBeLessThanOrEqual(1); // 오른쪽 끝
    expect(b.y - box.y).toBeLessThan(40); // 위쪽(내용 아래로 내려가지 않음)
  };
  const event = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '새벽 출조' }) });
  await check(event.getByRole('button', { name: '새벽 출조 일정 삭제' }), event);
  const pencil = (await event.getByRole('button', { name: '새벽 출조 일정 수정' }).boundingBox())!;
  const title = (await event.getByRole('heading', { name: '새벽 출조' }).boundingBox())!;
  expect(Math.abs(pencil.y - title.y)).toBeLessThan(30); // 제목과 같은 줄(위쪽)
});

test('새 일정: 일정 날짜가 맛집 휴무 요일이면 그 맛집은 고를 수 없고, 고른 뒤 휴무일로 바꾸면 저장을 막는다', async ({ page }, testInfo) => {
  const base = seed();
  base.places = base.places!.map((item) => (item.id === 'p2' ? { ...item, closed_days: [3] } : item)); // 바다횟집: 수요일 휴무
  const db = await fakeBackend(page, { ...base, angler_gear: [{ id: 'g1', angler: '김 조사', category: '로드', brand: '다이와', name: '레가리스' }] });
  await page.goto('./schedule?date=2026-11-11'); // 수요일
  if (testInfo.project.name !== 'desktop') await page.getByRole('button', { name: /^11 일 \(수\)/ }).click();
  await page.getByRole('button', { name: '일정 추가', exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 일정' });
  await dialog.getByLabel('할 일').fill('저녁');
  const search = dialog.getByRole('searchbox', { name: '장소 검색' });
  await search.fill('바다');
  await search.press('Enter');
  const saved = dialog.getByRole('button', { name: /바다횟집.*저장한 장소/ });
  await expect(saved).toBeDisabled();
  await expect(saved).toContainText('11월 11일(수) 휴무라 이 일정에는 고를 수 없습니다.');

  // 목요일에 고른 뒤 날짜를 수요일로 바꾸면 안내하고 저장하지 않습니다.
  await dialog.getByLabel('시작 날짜').fill('2026-11-12');
  await dialog.getByLabel('종료 날짜').fill('2026-11-12');
  await search.press('Enter');
  await expect(saved).toBeEnabled();
  await saved.click();
  await dialog.getByRole('checkbox', { name: /레가리스/ }).check();
  await dialog.getByLabel('시작 날짜').fill('2026-11-11');
  await dialog.getByLabel('종료 날짜').fill('2026-11-11');
  // 날짜를 바꾸는 순간 상태 영역(role=status)으로 알립니다.
  await expect(dialog.getByRole('status').filter({ hasText: '11월 11일(수) 휴무라 이 날짜에는 고를 수 없습니다.' })).toBeVisible();
  const before = db.events!.length;
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeVisible();
  expect(db.events!.length).toBe(before);
  await expect(dialog.getByRole('button', { name: '장소 빼기' })).toBeFocused();
});

test('장소 찾기: 이미 저장한 맛집과 같은 Kakao 결과는 빼서 저장한 장소로만 고른다(휴무 제한을 피해 가지 못함)', async ({ page }, testInfo) => {
  const base = seed();
  base.places = [...base.places!, { ...place('p9', '바다 횟집', 'restaurant'), latitude: 34.1, longitude: 127.4, closed_days: [3] }];
  await fakeBackend(page, base);
  await page.goto('./schedule?date=2026-11-11'); // 수요일
  if (testInfo.project.name !== 'desktop') await page.getByRole('button', { name: /^11 일 \(수\)/ }).click();
  await page.getByRole('button', { name: '일정 추가', exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 일정' });
  await dialog.getByRole('searchbox', { name: '장소 검색' }).fill('바다');
  await dialog.getByRole('searchbox', { name: '장소 검색' }).press('Enter');
  // Kakao 검색이 끝난 뒤(결과 수 안내가 뜬 뒤)에 셉니다: 저장한 장소 2곳(바다횟집, 바다 횟집) + Kakao 새 결과 1곳(바다 방파제)
  await expect(dialog.getByRole('status').filter({ hasText: '검색 결과 3건' })).toBeAttached();
  const results = dialog.getByRole('button', { name: /^바다 횟집/ });
  await expect(results).toHaveCount(1); // Kakao의 같은 맛집은 빠지고 저장한 장소 하나만
  await expect(results).toBeDisabled();
  await expect(dialog.getByRole('status').filter({ hasText: '휴무' })).toHaveCount(0);
});

test('장소 찾기: 주소로 찾아 이름이 맞지 않아도, Kakao 결과와 같은 저장 장소는 저장한 장소로 보여 준다', async ({ page }, testInfo) => {
  const base = seed();
  base.places = [...base.places!, { ...place('p9', '바다 횟집', 'restaurant'), latitude: 34.1, longitude: 127.4 }];
  await fakeBackend(page, base);
  await page.goto('./schedule?date=2026-11-12');
  if (testInfo.project.name !== 'desktop') await page.getByRole('button', { name: /^12 일 \(목\)/ }).click();
  await page.getByRole('button', { name: '일정 추가', exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 일정' });
  // 지도 SDK는 처음 찾을 때 받으므로 한 번 찾아 둔 뒤, 주소로 찾으면 Kakao가 '바다 횟집'(저장한 장소와 같은 곳)을 돌려준다고 둡니다.
  await dialog.getByRole('searchbox', { name: '장소 검색' }).fill('먼저');
  await dialog.getByRole('searchbox', { name: '장소 검색' }).press('Enter');
  await expect(dialog.getByRole('status').filter({ hasText: /검색 결과 \d+건/ })).toBeAttached();
  await page.evaluate(() => {
    const w = window as unknown as { kakao: { maps: { services: { Places: { prototype: { keywordSearch: (q: string, cb: (r: unknown[], s: string) => void) => void } }; Status: { OK: string } } } } };
    const { services } = w.kakao.maps;
    services.Places.prototype.keywordSearch = (_q, cb) => cb([{ place_name: '바다 횟집', road_address_name: '전남 여수시 횟집로 1', address_name: '', x: '127.4', y: '34.1', category_group_code: 'FD6' }], services.Status.OK);
  });
  await dialog.getByRole('searchbox', { name: '장소 검색' }).fill('여수'); // 이름에는 없는 말(주소)
  await dialog.getByRole('searchbox', { name: '장소 검색' }).press('Enter');
  await expect(dialog.getByRole('status').filter({ hasText: /검색 결과 \d+건/ })).toBeAttached();
  await expect(dialog.getByRole('button', { name: /^바다 횟집.*저장한 장소/ })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: /^바다 횟집/ })).toHaveCount(1);
});
