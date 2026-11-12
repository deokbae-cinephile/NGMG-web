// E2E: 로그인·첫 로딩·키보드·설정·게스트·화면 배치·찾기 칸
import { expect, test } from '@playwright/test';
import { acceptDialogs, expectAccessible, expectFits, fakeBackend, openRecords, seed } from './support';

acceptDialogs();

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
  // 알림도 다크 모드처럼 스위치입니다.
  const pushSwitch = page.getByRole('region', { name: '알림', exact: true }).getByRole('switch', { name: '이 기기에서 알림 받기' });
  await expect(pushSwitch).toBeEnabled();
  await expect(pushSwitch).toHaveAttribute('aria-checked', 'false');
  // 들어올 때 손잡이가 미끄러지지 않습니다(누르기 전에는 전환 효과 없음).
  expect(await pushSwitch.locator('.switch-thumb').evaluate((node) => getComputedStyle(node).transitionDuration)).toBe('0s');

  // 화면 테마: '다크 모드' 스위치(role=switch)로 켜고 끕니다.
  const theme = page.getByRole('region', { name: '화면 테마' });
  const darkSwitch = theme.getByRole('switch', { name: '다크 모드' });
  await expect(theme.getByRole('button')).toHaveCount(0); // 단추 대신 스위치입니다.
  await darkSwitch.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(darkSwitch).toHaveAttribute('aria-checked', 'true');
  await darkSwitch.press('Space'); // 키보드로도 켜고 끕니다.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(darkSwitch).toHaveAttribute('aria-checked', 'false');

  // 앱 설치: 설치할 수 있는 브라우저가 보내는 설치 제안을 흉내 냅니다.
  await page.evaluate(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) }));
  });
  await expect(page.getByRole('region', { name: '앱 설치' }).getByRole('button', { name: '앱 설치' })).toBeVisible();
  await expect(page.getByRole('region', { name: '앱 정보' })).toContainText(/v\d+\.\d+\.\d+ \(\d{4}\.\d{2}\.\d{2}\)/); // 버전 뒤에 배포 날짜
  await expectFits(page);
  await expectAccessible(page);

  // 물품 주소는 /items이고, 예전 주소 /gear는 /items로 넘깁니다.
  await page.goto('./gear');
  await expect(page).toHaveURL(/\/items$/);
  await expect(page).toHaveTitle('물품 | 낚고먹고');
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
  expect(new Set(links).size).toBe(1); // 6칸이 같은 너비입니다.
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
  await page.goto('./place?id=p1');
  await expect(page.getByRole('button', { name: /장소 수정|장소 삭제|기록 추가|기록 수정/ })).toHaveCount(0);
  await page.goto('./settings');
  await expect(page.getByText('게스트 계정은 알림을 켤 수 없습니다.')).toBeVisible();
  await expectAccessible(page);
});

test('찾기 칸은 지도·전체 기록·도감 모두 같은 모양이다(안내 글자, 찾기 단추 없음, 입력하는 대로)', async ({ page }) => {
  await fakeBackend(page, seed());
  for (const [url, name] of [['./', '이름·주소로 찾기'], ['./schedule', '기록 찾기 (장소·조과·어종·음식·메모)'], ['./dex', '어종 찾기 (어종·조사·장소)']]) {
    if (url === './schedule') await openRecords(page);
    else await page.goto(url);
    const box = page.getByRole('search').getByRole('searchbox', { name, exact: true });
    await expect(box).toBeAttached();
    expect(await box.getAttribute('placeholder')).toBeTruthy(); // 이름표 대신 칸 안의 안내 글자
    await expect(page.getByRole('search').getByRole('button')).toHaveCount(0);
  }
});

test('아이콘 단추: 모든 화면에서 아이콘이 실제 크기로 보인다(주요 단추·삭제 단추 포함), 라이트·다크', async ({ page }) => {
  await fakeBackend(page, { ...seed(), angler_gear: [{ id: 'g1', angler: '김 조사', category: '로드', brand: '다이와', name: '레가리스' }] });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const [url, ready] of [['./', '장소 추가'], ['./schedule?date=2026-11-07', '오늘'], ['./items', '물품 추가'], ['./place?id=p1', '장소 수정']] as const) {
      await page.goto(url);
      await expect(page.getByRole('button', { name: ready, exact: true }).first()).toBeAttached();
      await expect.poll(() => page.locator('.icon-only, .map-tool').count(), { message: `${url}에 검사할 아이콘 단추가 없습니다` }).toBeGreaterThan(0);
      const broken = await page.locator('.icon-only, .map-tool').evaluateAll((buttons) =>
        buttons
          .filter((button) => (button as HTMLElement).offsetParent !== null)
          .filter((button) => {
            const icon = button.querySelector('svg')?.getBoundingClientRect();
            const style = getComputedStyle(button.querySelector('svg')!);
            return !icon || icon.width < 16 || icon.height < 16 || style.stroke === getComputedStyle(button).backgroundColor;
          })
          .map((button) => button.getAttribute('aria-label')),
      );
      expect(broken, `${theme} ${url}`).toEqual([]);
    }
  }
});

test('장소 상세: 예전 주소(/places/<id>)로 들어와도 새 주소(/place?id=)로 넘어가고, 새 주소는 place.html이 200으로 받는다', async ({ page }) => {
  await fakeBackend(page, seed());
  await page.goto('./places/p1');
  await expect(page).toHaveURL(/\/place\?id=p1$/);
  await expect(page.getByRole('button', { name: '장소 수정', exact: true })).toBeVisible();
  const response = await page.goto('./place?id=p1');
  expect(response?.status()).toBe(200);
  await page.goto('./place');
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
});
