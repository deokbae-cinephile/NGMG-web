// E2E 공통 도우미: 가짜 서버 시작, 기본 자료, 화면 넘침·접근성 검사
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { startFakeBackend as fakeBackend, type Seed } from './fake-backend';

export { fakeBackend };

export const LONG_NAME = '아주아주긴이름의낚시포인트'.repeat(8);

export const place = (id: string, name: string, kind = 'fishing') => ({
  id, name, kind, address: '전남 여수시 삼산면', latitude: 34.03, longitude: 127.3, memo: '',
});

export const seed = (): Seed => ({
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
export const openRecords = async (page: Page) => {
  await page.goto('./records');
  await expect(page.getByRole('heading', { name: '전체 기록' })).toBeVisible();
  const toggle = page.getByRole('button', { name: '전체 기록' });
  if (await toggle.isVisible()) {
    await expect(toggle).toHaveAttribute('aria-expanded', 'false'); // 휴대폰에서는 접힌 채로 시작합니다.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
};

export const expectFits = async (page: Page) => {
  // 문서 가로 스크롤과 함께, 잘려서 스크롤이 안 생기는 경우도 잡도록 본문 요소의 오른쪽 끝을 봅니다.
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const right = Math.max(...[...document.querySelectorAll('main *')].map((el) => el.getBoundingClientRect().right));
    return Math.max(document.documentElement.scrollWidth - width, right - width);
  });
  expect(overflow).toBeLessThanOrEqual(0.5);
};

export const expectAccessible = async (page: Page) => {
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

/** 모든 테스트에서 확인 창(confirm)은 '확인'으로 넘깁니다. 각 spec 파일 맨 위에서 부릅니다. */
export const acceptDialogs = () =>
  test.beforeEach(({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
  });
