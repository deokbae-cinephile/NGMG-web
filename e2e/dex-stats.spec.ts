// E2E: 도감·통계
import { expect, test } from '@playwright/test';
import { acceptDialogs, expectAccessible, expectFits, fakeBackend, place, seed } from './support';

acceptDialogs();

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
  await expect(card.getByRole('definition').filter({ hasText: /^2$/ })).toBeVisible(); // 마릿수는 단위 없이 숫자만
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
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '모둠회' }) }).getByRole('definition').filter({ hasText: /^\d+$/ })).toBeVisible(); // 먹은 횟수는 단위 없이 숫자만
  // 음식 도감은 번호 없이 평점 높은 순입니다.
  await expect(page.getByText(/^No\./)).toHaveCount(0);
  const menus = await page.getByRole('listitem').getByRole('heading', { level: 3 }).allTextContents();
  expect(menus).toEqual(['모둠회', '매운탕']);
  // 한 사람만 준 평점도 보여 줍니다.
  await expect(
    page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '매운탕' }) }).getByRole('definition').filter({ hasText: '김 조사 평점을 기다리는 중 (류 조사 3.5점)' }),
  ).toBeVisible();

  // 기록에도 보이고, 수정 폼을 열면 준 평점이 그대로 골라져 있습니다(다시 저장해도 지워지지 않음).
  await page.goto('./places/p2');
  // 음식 줄: 화면 읽기 프로그램에도 노출되는지(접근성 트리) 확인합니다.
  const menuLine = page.getByRole('listitem').filter({ hasText: '매운탕' }).first();
  expect(await menuLine.ariaSnapshot()).toContain('김 조사 평점을 기다리는 중 (류 조사 3.5점)');
  // 기록의 평점 줄은 기록 평점과 음식 평점의 대기를 나눠 씁니다.
  await expect(page.getByRole('definition').filter({ hasText: /^김 조사 음식 평점을 기다리는 중$/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /기록 수정/ }).first().click();
  await expect(page.getByRole('dialog', { name: '기록 수정' }).getByLabel(/음식 2 류 조사 평점/)).toHaveValue('3.5');
});

test('통계: 출조 횟수·잡은 물고기, 월별 출조, 자주 간 낚시 포인트·맛집만 보여 준다', async ({ page }) => {
  // 통계는 기록이 있는 가장 최근 해를 먼저 보여 줍니다. 시계를 고정해 그해가 2026년이 되게 합니다.
  const year = 2026;
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00+09:00'));
  await fakeBackend(page, {
    places: [place('p1', '거문도 방파제'), place('p4', '가거도 갯바위'), place('p2', '바다횟집', 'restaurant')],
    records: [
      { id: 'a', place_id: 'p1', visited_on: `${year}-01-05`, catches: '', rating: 4 },
      { id: 'b', place_id: 'p1', visited_on: `${year}-01-20`, catches: '', rating: 5 },
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
  // 자주 간 장소는 낚시 포인트(왼쪽)와 맛집(오른쪽)으로 나누고, 둘 다 평균 평점을 보여 줍니다(평점이 없으면 생략).
  const spots = page.getByRole('region', { name: '자주 간 낚시 포인트' });
  await expect(spots.getByRole('listitem')).toHaveText([/거문도 방파제\s*평균 평점\s*4\.5\s*2번$/, /가거도 갯바위\s*1번$/]);
  await expect(spots).not.toContainText(/마리/); // 마릿수는 사용자 요청으로 뺐습니다.
  const restaurants = page.getByRole('region', { name: '자주 간 맛집' });
  await expect(restaurants.getByRole('listitem')).toHaveText([/바다횟집\s*평균 평점\s*4\.0\s*1번/]);
  await expectFits(page);
  await expectAccessible(page);
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
  // 고른 탭은 굵게 보이되, 글꼴이 바뀌어 작아지지 않습니다(고르지 않은 탭과 글자 폭이 같음).
  const width = (name: string) => page.getByRole('button', { name }).evaluate((node) => { const range = document.createRange(); range.selectNodeContents(node); return Math.round(range.getBoundingClientRect().width); });
  expect(await page.getByRole('button', { name: '어종 도감' }).evaluate((node) => getComputedStyle(node).webkitTextStrokeWidth)).not.toBe('0px');
  expect(Math.abs((await width('어종 도감')) - (await width('음식 도감')))).toBeLessThanOrEqual(1);
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
