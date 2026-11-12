// E2E: 기록(작성·수정·검색·사진·저장 대기열)
import { expect, test } from '@playwright/test';
import { acceptDialogs, expectAccessible, expectFits, fakeBackend, openRecords, seed } from './support';

acceptDialogs();

test('기록: 사진과 함께 저장한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./place?id=p1');
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
  await fish.getByLabel('물고기 1 사진', { exact: true }).setInputFiles({ name: '볼락-1.png', mimeType: 'image/png', buffer: png });
  await expect(fish.getByRole('img', { name: '물고기 1 새 사진 1 미리보기' })).toBeVisible();
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

test('기록: 물고기·음식 한 칸에 사진을 5장까지 올리고(첫 장이 대표), 넘치면 알리며, 기록에 모두 보인다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const files = [1, 2, 3, 4, 5, 6].map((n) => ({ name: `사진-${n}.png`, mimeType: 'image/png', buffer: png }));
  await page.goto('./place?id=p1');
  await page.getByRole('button', { name: '기록 추가' }).click();
  let dialog = page.getByRole('dialog', { name: '새 기록' });
  await dialog.getByRole('button', { name: '물고기 추가' }).click();
  const fish = dialog.getByRole('group', { name: '물고기 1' });
  await fish.getByLabel('어종').fill('볼락');
  await fish.getByLabel('길이 (cm)').fill('20');
  await expect(dialog.getByText(/여러 장을 고르면/)).toHaveCount(0); // 줄을 늘리던 예전 안내는 없습니다.
  await fish.getByLabel('물고기 1 사진', { exact: true }).setInputFiles(files); // 6장을 골라도 5장만 넣고 알립니다.
  await expect(fish.getByRole('status')).toHaveText('사진은 5장까지라 5장만 넣었습니다.');
  await expect(fish.getByRole('list', { name: '물고기 1 사진 5장' }).getByRole('img')).toHaveCount(5);
  await expect(fish.getByLabel('물고기 1 사진', { exact: true })).toBeDisabled();
  await expect(dialog.getByRole('group', { name: '물고기 2' })).toHaveCount(0); // 줄은 늘리지 않습니다.
  await fish.getByRole('button', { name: '물고기 1 새 사진 5 빼기' }).click();
  await expect(fish.getByLabel('물고기 1 사진', { exact: true })).toBeEnabled();
  await expect(fish.getByLabel('물고기 1 사진', { exact: true })).toBeFocused(); // 지운 단추가 사라져도 초점이 사진 칸으로 옵니다.
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  const saved = db.fish_catches!.at(-1)!;
  expect(saved.photo_path).toMatch(/fish-/);
  expect(saved.extra_photo_paths).toHaveLength(3); // 대표 1장 + 3장
  // 기록 카드에 대표 사진과 나머지 사진이 함께 보입니다.
  await expect(page.getByRole('list', { name: /사진 3장 더$/ }).getByRole('img')).toHaveCount(3);

  // 다시 열면 4장이 그대로이고, 하나를 지우면 그 파일도 지웁니다.
  await page.getByRole('button', { name: /기록 수정/ }).first().click();
  dialog = page.getByRole('dialog', { name: '기록 수정' });
  const edit = dialog.getByRole('group', { name: '물고기 1' });
  await expect(edit.getByRole('list', { name: '물고기 1 사진 4장' }).getByRole('img')).toHaveCount(4);
  const removedPath = (saved.extra_photo_paths as string[])[2];
  await edit.getByRole('button', { name: '물고기 1 사진 4 삭제' }).click();
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.fish_catches!.at(-1)!.extra_photo_paths).toHaveLength(2);
  expect(db.removedFiles).toContain(removedPath);

  // 음식도 같은 칸입니다.
  await page.goto('./place?id=p2');
  await page.getByRole('button', { name: '기록 추가' }).click();
  dialog = page.getByRole('dialog', { name: '새 기록' });
  await dialog.getByLabel('음식 1 사진').setInputFiles(files.slice(0, 2));
  await expect(dialog.getByRole('list', { name: '음식 1 사진 2장' }).getByRole('img')).toHaveCount(2);
  await expect(dialog.getByLabel('음식 2', { exact: true })).toHaveCount(0); // 음식 줄은 늘지 않습니다.
});

test('기록: 입력 항목을 줄여도 예전 값은 지워지지 않고, 연박 날짜를 저장한다', async ({ page }) => {
  const base = seed();
  base.records![0] = { ...base.records![0]!, people: 2, companions: '국환, 창선', weather: '맑음' };
  const db = await fakeBackend(page, base);
  await page.goto('./place?id=p1');
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
  await expect(page.getByRole('button', { name: '찾기', exact: true })).toHaveCount(0); // 찾기 단추 없이 입력하는 대로 찾습니다.
  await search.fill('망둥어');
  await expect(pane.getByText('거대 망둥어 17cm')).toBeVisible();
  await expect(pane.getByText('감성돔 1마리')).toBeHidden();

  // 장소 이름으로도 찾습니다.
  await search.fill('바다횟');
  await expect(pane.getByText('모둠회')).toBeVisible();
  await expect(pane.getByText('감성돔 2마리')).toBeHidden();
  await search.fill('');

  await expect(pane.getByText(/조건 더 보기/)).toHaveCount(0);
  await expectAccessible(page);
});

test('기록: 크기·시각이 같은 사진 두 장도 서로 덮어쓰지 않고 모두 저장한다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await page.goto('./place?id=p1');
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  await dialog.getByLabel('사진 추가').setInputFiles([
    { name: '연속-1.png', mimeType: 'image/png', buffer: png },
    { name: '연속-2.png', mimeType: 'image/png', buffer: png },
  ]);
  await expect(dialog.getByRole('img', { name: '올릴 사진 2 미리보기' })).toBeVisible();
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  const recordId = db.records!.at(-1)!.id;
  const paths = db.record_photos!.filter((photo) => photo.record_id === recordId).map((photo) => photo.storage_path);
  expect(paths).toHaveLength(2);
  expect(new Set(paths).size).toBe(2);
});

test('사진 미리보기의 X 버튼으로 뺀다, 통계 순서, 기록에 인원·동행을 보이지 않는다', async ({ page }) => {
  const base = seed();
  base.records![0] = { ...base.records![0]!, people: 2, companions: '국환, 창선' };
  await fakeBackend(page, base);
  await page.goto('./place?id=p1');
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
  await page.goto('./place?id=p1');
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
  await page.goto('./place?id=p1');
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
    await page.goto('./place?id=p1');
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
  await page.goto('./place?id=p1');
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
  await page.goto('./place?id=p1');
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  await dialog.getByRole('button', { name: '물고기 추가' }).click();
  const fish = dialog.getByRole('group', { name: '물고기 1', exact: true });
  await fish.getByRole('group', { name: '물고기 1 전에 잡은 어종' }).getByRole('button', { name: '감성돔' }).click();
  await expect(fish.getByLabel('어종')).toHaveValue('감성돔');
  await expect(fish.getByRole('button', { name: '감성돔' })).toHaveAttribute('aria-pressed', 'true');
});

test('전체 기록: 입력하는 대로 찾고, 결과를 상태 영역으로 알린다', async ({ page }) => {
  await fakeBackend(page, seed());
  await openRecords(page);
  await page.getByRole('searchbox', { name: /기록 찾기/ }).fill('없는말');
  await expect(page.getByRole('status').filter({ hasText: "'없는말'이(가) 들어간 기록이 없습니다." })).toBeAttached();
  await page.getByRole('searchbox', { name: /기록 찾기/ }).fill('감성돔');
  await expect(page.getByRole('status').filter({ hasText: /'감성돔'이\(가\) 들어간 기록 \d+건( 이상)?을 찾았습니다\./ })).toBeAttached();
});

test('전체 기록: 분류 필터는 지도와 같은 붙인 아이콘 단추다', async ({ page }) => {
  await fakeBackend(page, seed());
  await openRecords(page);
  const group = page.getByRole('group', { name: '분류' });
  await expect(group.getByRole('button')).toHaveCount(5);
  expect(await group.getByRole('button').evaluateAll((items) => items.map((item) => [item.getAttribute('aria-label'), item.textContent]))).toEqual([
    ['전체', ''],
    ['낚시', ''],
    ['맛집', ''],
    ['숙박', ''],
    ['기타', ''],
  ]);
  await group.getByRole('button', { name: '맛집' }).click();
  await expect(group.getByRole('button', { name: '맛집' })).toHaveAttribute('aria-pressed', 'true');
});

test('음식 가격 칸: 초점이 있을 때 마우스 휠을 굴려도 값이 바뀌지 않고, 쉼표·원만 지우며 잘못된 값은 안내한다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./place?id=p2');
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  const price = dialog.getByLabel('음식 1 가격 (원)');
  await price.fill('12,000원');
  await expect(price).toHaveValue('12000');
  await expect(price).toHaveAttribute('inputmode', 'numeric');
  await price.focus();
  await price.hover();
  for (const delta of [-300, 300]) {
    await page.mouse.wheel(0, delta);
    await expect(price).toHaveValue('12000'); // 휠을 굴릴 때마다 그대로입니다.
  }
  // 소수점·음수는 다른 값으로 바꾸지 않고 저장할 때 오류로 알립니다.
  await dialog.getByLabel('음식 1', { exact: true }).fill('모둠회');
  for (const wrong of ['1.5', '-12000', '0x10', '1e3']) {
    await price.fill(wrong);
    await expect(price).toHaveValue(wrong);
    await dialog.getByRole('button', { name: '저장' }).click();
    await expect(dialog.getByText('0 이상의 정수로 입력해 주세요.')).toBeVisible();
  }
});

test('큰 사진(가로 5000px 이상)도 줄여 읽어 1600px 사진으로 올린다', async ({ page }) => {
  const db = await fakeBackend(page, seed());
  await page.goto('./place?id=p1');
  const big = Buffer.from(
    (
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 5200;
        canvas.height = 3900;
        const context = canvas.getContext('2d')!;
        context.fillStyle = '#3a7';
        context.fillRect(0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.6);
      })
    ).split(',')[1]!,
    'base64',
  );
  const sizes: number[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/storage/v1/object/') && !request.url().includes('.thumb.')) sizes.push(request.postDataBuffer()?.length ?? 0);
  });
  const before = db.record_photos!.length;
  await page.getByRole('button', { name: '기록 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 기록' });
  await dialog.getByLabel('사진 추가').setInputFiles({ name: '큰사진.jpg', mimeType: 'image/jpeg', buffer: big });
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.record_photos!.length).toBe(before + 1); // 새 사진 행이 저장됐습니다.
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.max(...sizes)).toBeLessThan(big.length); // 줄여서 올렸습니다.
});
