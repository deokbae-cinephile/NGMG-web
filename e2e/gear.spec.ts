// E2E: 장비와 일정의 챙길 장비 체크리스트
import { expect, test } from '@playwright/test';
import { acceptDialogs, expectAccessible, expectFits, fakeBackend, seed } from './support';

acceptDialogs();

const gear = [
  { id: 'g1', angler: '김 조사', category: '로드', subcategory: '', brand: '다이와', name: '레가리스', memo: '', photo_path: null, position: 0, created_at: '2026-01-01T00:00:00Z' },
  { id: 'g2', angler: '김 조사', category: '릴', subcategory: '', brand: '', name: '스텔라', memo: '', photo_path: null, position: 0, created_at: '2026-01-02T00:00:00Z' },
  { id: 'g3', angler: '류 조사', category: '라인', subcategory: '목줄', brand: '선라인', name: '1.5호', memo: '', photo_path: null, position: 0, created_at: '2026-01-03T00:00:00Z' },
];

test('장비: 설정에서 장비 화면으로 가서 조사별로 등록·수정·삭제한다(태그는 아이콘 + [브랜드] 제품명)', async ({ page }) => {
  const db = await fakeBackend(page, { ...seed(), angler_gear: gear });
  await page.goto('./settings');
  await page.getByRole('link', { name: '장비 관리' }).click();
  await expect(page).toHaveTitle('장비 | 낚고먹고');
  await expect(page.getByRole('region', { name: '로드' }).getByText('[다이와] 레가리스')).toBeVisible();
  await expect(page.getByRole('region', { name: '릴' }).getByText('스텔라', { exact: true })).toBeVisible(); // 브랜드가 없으면 제품명만
  // 분류는 아이콘으로 보이고, 화면 읽기 프로그램에는 이름도 알립니다.
  expect(await page.getByRole('region', { name: '로드' }).getByRole('listitem').first().ariaSnapshot()).toContain('로드 [다이와] 레가리스');
  await expectFits(page);
  await expectAccessible(page);

  await page.getByRole('button', { name: '장비 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '새 장비' });
  await dialog.getByLabel('분류').selectOption('라인');
  await dialog.getByRole('radio', { name: '원줄' }).check();
  await dialog.getByLabel('브랜드').fill('바리바스');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog.getByText('제품명을 입력해 주세요.')).toBeVisible();
  await dialog.getByLabel('제품명').fill('2호');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.angler_gear!.at(-1)).toMatchObject({ angler: '김 조사', category: '라인', subcategory: '원줄', brand: '바리바스', name: '2호' });
  await expect(page.getByRole('region', { name: '원줄' }).getByText('[바리바스] 2호')).toBeVisible();

  await page.getByRole('button', { name: '[다이와] 레가리스 삭제' }).click();
  await expect(page.getByText('[다이와] 레가리스')).toHaveCount(0);
  await page.getByRole('button', { name: '류 조사' }).click();
  await expect(page.getByRole('region', { name: '목줄' }).getByText('[선라인] 1.5호')).toBeVisible();
});

test('일정: 챙길 장비를 고르면 그날 일정에 체크리스트로 보이고, 챙긴 것을 체크한다', async ({ page }) => {
  const db = await fakeBackend(page, { ...seed(), angler_gear: gear });
  await page.goto('./schedule?date=2026-11-07');
  await expect(page.getByRole('heading', { name: '새벽 출조' })).toBeVisible();
  await page.getByRole('button', { name: '새벽 출조 일정 수정' }).click();
  const dialog = page.getByRole('dialog', { name: '일정 수정' });
  const picker = dialog.getByRole('group', { name: '챙길 장비' });
  await picker.getByRole('checkbox', { name: /레가리스/ }).check();
  await picker.getByRole('checkbox', { name: /스텔라/ }).check();
  await picker.getByRole('checkbox', { name: /1\.5호/ }).check();
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.events![0]).toMatchObject({ gear_ids: ['g1', 'g2', 'g3'], packed_gear_ids: [] });

  const checklist = page.getByRole('group', { name: /챙길 장비 3개 중 0개 챙김/ });
  await expect(checklist).toBeVisible();
  await expect(checklist.getByText('[다이와] 레가리스')).toBeVisible();
  // 체크하면 묶음 이름(몇 개 챙김)이 바뀌므로, 체크 칸은 이름이 바뀌지 않는 일정 안에서 찾습니다.
  await page.locator('.pane-day').getByRole('checkbox', { name: '로드 [다이와] 레가리스' }).click();
  await expect(page.getByRole('group', { name: /챙길 장비 3개 중 1개 챙김/ })).toBeVisible();
  await expect.poll(() => db.events![0]!.packed_gear_ids).toEqual(['g1']);
  await expectAccessible(page);

  // 수정 창을 연 뒤 다른 사람이 체크해도, 장비만 바꿔 저장하면 그 체크는 남고 뺀 장비의 챙김만 지워집니다.
  await page.getByRole('button', { name: '새벽 출조 일정 수정' }).click();
  db.events![0]!.packed_gear_ids = ['g1', 'g2', 'g3'];
  await picker.getByRole('checkbox', { name: /스텔라/ }).uncheck();
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  expect(db.events![0]).toMatchObject({ gear_ids: ['g1', 'g3'], packed_gear_ids: ['g1', 'g3'] });
});

test('게스트: 장비 체크리스트는 보기만 한다', async ({ page }) => {
  const base = seed();
  base.events![0] = { ...base.events![0]!, gear_ids: ['g1'], packed_gear_ids: [] };
  await fakeBackend(page, { ...base, angler_gear: gear, members: [{ id: 'm-u1', user_id: 'u1', role: 'guest' }] });
  await page.goto('./schedule?date=2026-11-07');
  await expect(page.getByText(/게스트로 보는 중/)).toBeVisible();
  await expect(page.getByRole('group', { name: /챙길 장비 1개 중 0개 챙김/ }).getByRole('checkbox')).toBeDisabled();
});
