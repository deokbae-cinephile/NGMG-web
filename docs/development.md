# 개발 가이드

## 환경 변수

`.env.example`을 `.env`로 복사해 채웁니다. 배포할 때는 같은 이름으로 GitHub 저장소 Secrets에 넣습니다.

| 변수                                             | 용도                         |
| ------------------------------------------------ | ---------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`    | Supabase 연결. 없으면 앱이 시작되지 않습니다. |
| `VITE_KAKAO_MAP_KEY`                             | Kakao 지도·장소 검색. 없으면 지도와 검색만 동작하지 않습니다. |

세 값은 브라우저에 공개되는 값입니다. 데이터는 RLS가, Kakao 키는 등록된 도메인 제한이 보호합니다. `service_role` 키는 절대 넣지 않습니다.

## 데모

데모는 Supabase와 Kakao SDK 응답을 `e2e/fake-server.ts`의 가짜 서버로 대신합니다. 앱 코드(`src/`)에는 데모 분기가 없습니다. 지도는 실제 지도가 아니라 가짜 배경이고, 올린 사진도 자리표시 그림으로 보입니다.

| 방법 | 설명 |
| --- | --- |
| `pnpm run demo` | 개발 서버와 Playwright 브라우저 창을 띄웁니다. 날씨도 가짜 값입니다. |
| `pnpm run build:demo` | 정적 파일로 빌드합니다. `e2e/demo-setup.ts`가 브라우저의 `fetch`를 가로채 응답하고. 고친 데이터는 탭을 닫기 전까지 sessionStorage에 남습니다. |

## 서버 준비 (Supabase)

```bash
supabase login                      # 브라우저 승인이 필요해 별도 터미널에서 실행합니다.
supabase link --project-ref <프로젝트 ID>
supabase db push --remote
supabase config push                # 가입을 닫습니다 (enable_signup = false)
```

두 사람은 공용 계정 하나를 함께 씁니다. 가입 화면은 없습니다.

1. 대시보드 **Authentication > Users > Add user**에서 계정을 하나 만들고 **Auto Confirm User**를 켭니다.
2. 계정을 멤버로 등록합니다. 등록되지 않은 계정은 로그인해도 빈 화면만 보이고 쓰기는 실패하므로, 가입 설정이 실수로 켜져도 다른 사람은 데이터에 접근하지 못합니다.

```bash
supabase db query --remote "insert into public.members (user_id) select id from auth.users on conflict do nothing"
```

로그인은 기기마다 한 번만 하면 유지됩니다.

무료 플랜은 오랫동안 접속이 없으면 프로젝트가 일시 중지될 수 있습니다. 그때는 대시보드에서 다시 시작합니다.

## 알림 (웹 푸시)

출조 전날 20시(내일 일정이 있을 때)와 일요일 20시(한 사람만 평점을 준 기록이 있을 때) 알림을 보냅니다. 일정 화면의 **출조 알림**에서 기기마다 켜고, 켜면 테스트 알림이 바로 옵니다. 아이폰은 홈 화면에 추가한 앱(iOS 16.4 이상)에서만 받을 수 있습니다.

- 구독: `push_subscriptions` 표(멤버만 읽고 씀)
- 보내기: Edge Function `supabase/functions/notify`(VAPID 웹 푸시). 없어진 구독(404·410)은 지웁니다.
- 예약: pg_cron `ngmg-daily-notify`가 매일 UTC 11시에 Vault의 `notify_url`로 `notify_cron_secret`을 붙여 부릅니다. `notify_url`이 없으면 부르지 않고, `notify_cron_secret`이 없거나 함수의 `CRON_SECRET`과 다르면 함수가 403으로 거절합니다.

새 프로젝트에서는 한 번만 준비합니다. 키와 비밀 값은 저장소에 넣지 않습니다.

```bash
# VAPID 키(P-256)와 예약 호출 비밀 값을 만들어 함수 비밀 값으로 넣습니다.
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:관리자@도메인 CRON_SECRET=...
supabase functions deploy notify --use-api
# 예약 호출이 쓸 주소와 비밀 값(위 CRON_SECRET과 같은 값)을 Vault에 넣습니다.
supabase db query --remote "select vault.create_secret('<CRON_SECRET>', 'notify_cron_secret'); select vault.create_secret('https://<프로젝트 ID>.supabase.co/functions/v1/notify', 'notify_url')"
```

## Kakao 지도 준비

1. [Kakao Developers](https://developers.kakao.com)에서 앱을 만들고 **카카오맵** 사용을 켭니다.
2. **플랫폼 > Web**에 `https://ngmg.kr`과 `https://www.ngmg.kr`을 등록합니다. (Kakao 콘솔이 localhost를 거절해 로컬에서는 지도가 뜨지 않을 수 있습니다.)
3. **JavaScript 키**를 `VITE_KAKAO_MAP_KEY`에 넣습니다.

## 배포 (GitHub Pages)

1. 저장소 Pages의 Source는 **GitHub Actions**로 설정되어 있습니다.
2. **Settings > Secrets and variables > Actions**에 위 환경 변수 3개를 넣습니다. 3개가 모두 없으면 `deploy.yml`이 웹 데모(`build:demo`)를 배포하고, 일부만 있으면 실패합니다.
3. `main`에 올리거나 **Actions > Deploy**를 다시 실행하면 배포됩니다. 주소는 `https://ngmg.kr`입니다.

사용자 도메인은 저장소 **Settings > Pages > Custom domain**에 `ngmg.kr`로 걸려 있고, DNS는 hosting.kr에서 A 레코드 4개(`185.199.108~111.153`)와 `www` CNAME(`deokbae-cinephile.github.io`)으로 연결합니다. 도메인을 바꾸면 `supabase/config.toml`의 `site_url`과 Kakao 플랫폼 도메인도 함께 바꿉니다. 새로고침을 지원하려고 빌드할 때 `index.html`을 `404.html`로 복사합니다.

## PR 리뷰

`main`에는 브랜치와 PR로 올리고, 검사가 통과하면 squash로 merge합니다. CodeRabbit이 `main` 대상 PR을 자동으로 리뷰하며, 기준은 `.coderabbit.yaml`에 있습니다. 초안(Draft) PR은 자동 리뷰에서 제외됩니다. Ready로 바꾼 뒤에도 리뷰가 시작되지 않으면 PR에 `@coderabbitai review` 댓글을 남겨 요청합니다.

## 테스트

| 종류 | 위치 | 비고 |
| --- | --- | --- |
| E2E | `e2e/app.spec.ts` | 핵심 흐름 8개를 프로덕션 빌드로 360·768·1280px에서 검사합니다. 넘침과 axe 접근성 검사를 포함합니다. |

프로젝트를 가볍게 두려고 단위 테스트와 DB 권한 테스트는 두지 않습니다. E2E의 Supabase와 Kakao SDK는 `e2e/fake-backend.ts`가 흉내 냅니다. 실제 서비스와의 연동은 검증하지 않으므로, 서버를 연결한 뒤에는 직접 확인합니다.

## 현재 위치

지도의 "현재 위치에서 가까운 순"을 누를 때만 브라우저에 위치를 묻습니다. 위치는 화면의 정렬과 직선거리 표시에만 쓰고, 저장하거나 서버로 보내지 않습니다.

## 화면 설정 저장

지도 위치(`map-view`), 위성 지도 여부(`map-satellite`), 분류 필터(`map-filter`, `records-filter`) 같은 화면 설정만 기기의 localStorage에 `ngmg:` 접두어로 저장합니다(`src/shared/lib/preferences.ts`). 로그인 세션은 Supabase 인증 클라이언트가 localStorage에 관리합니다.

## 디자인 토큰

`src/app/styles.css`의 `@theme`에 있습니다.

| 토큰 | 값 | 쓰임 |
| --- | --- | --- |
| `paper` / `surface` | `#fafafa` / `#f0f0f0` | 바탕 / 입력란·강조 영역 |
| `ink` / `muted` | `#0a0a0a` / `#595959` | 글자·칸 선 / 보조 글자·라벨 |
| `soft` / `field` | `#d9d9d9` / `#8c8c8c` | 옅은 구분선 / 입력란 테두리 |
| `accent` | `#f0932b` | 선택된 메뉴·필터·핀, 그래프 칠하기(그 위 글자는 검정) |
| `sun` / `sat` | `#d4271b` / `#1f5fb4` | 일요일·공휴일 / 토요일 |
| `danger` | `#b3221e` | 삭제·오류 |

제목 크기는 칸 제목(h2) 20px, 칸 안 소제목(h3) 18px, 목록 항목 16px입니다. 장소 분류는 핀과 배지의 채움으로 구분합니다(낚시: 검정, 맛집: 흰색, 기타: 연회색).

글꼴은 도현(Do Hyeon) 하나를 `@fontsource/do-hyeon`으로 포함합니다. 한글이 여러 조각으로 나뉘어 화면에 쓰인 조각만 받으며, 조각이 CSS에 base64로 박히지 않도록 `vite.config.ts`에서 글꼴 파일은 인라인하지 않습니다.

## 첫 로딩과 화면 전환

- 첫 화면(`src/app/splash.tsx`): 가운데 로고만 놓인 스플래시가 앱이 준비될 때까지 보였다가 서서히 사라집니다. 탭마다 한 번만 로고를 보여 주고(`sessionStorage`의 `ngmg:intro`), 그 뒤에는 바탕만 덮었다가 바로 엽니다. `index.html`의 `#boot`가 같은 모습이라 자바스크립트를 받는 동안에도 이어집니다.
- 화면 전환: 로그인 뒤 다른 메뉴의 코드를 미리 받고, 데이터가 오는 동안에는 스켈레톤(`src/shared/ui/skeleton.tsx`)으로 자리를 잡아 화면이 밀리지 않게 합니다.
- 지도는 마지막으로 보던 곳에서 시작합니다(`map-view`). 저장된 위치가 없으면 무악재역에서 시작합니다.

## 경량화 원칙

- 라우터는 `src/shared/lib/router.tsx`(History API), 달력은 `src/pages/schedule/month-calendar.tsx`(WAI-ARIA 날짜 표 패턴), 날짜 계산은 `src/shared/lib/date.ts`(Date·Intl)로 직접 만들어 라이브러리를 쓰지 않습니다.
- Supabase는 `supabase-js` 대신 DB 클라이언트(`postgrest-js`)만 씁니다(`src/shared/api/supabase.ts`). 로그인은 비밀번호 로그인과 토큰 갱신만 하는 작은 클라이언트(`src/shared/api/auth.ts`)로, 사진 저장소는 서명 주소·올리기·지우기 요청을 직접 보냅니다. 저장 키와 세션 모양이 supabase-js와 같아 로그인이 유지됩니다.
- 사진은 올릴 때 긴 변 1600px 원본과 480px 썸네일(`*.thumb.jpg`)을 함께 저장합니다(`src/shared/api/photos.ts`). 64px 칸과 도감 카드는 썸네일을 쓰고, 썸네일이 없는 예전 사진은 원본을 씁니다. 사진은 한 번만 읽어 둘을 만들고, 여러 장은 3장씩 함께 올립니다(`forEachLimit`). 받아 둔 서명 주소는 1시간 넘게 남았으면 다시 쓰고, 글꼴 CSS의 woff 대체 경로는 빌드에서 뺍니다(`vite.config.ts`). 도감은 화면에 보이는 대표 사진만 서명 주소를 받습니다.
- 첫 화면인 로그인 폼은 기본 HTML 폼으로 만들고, `react-hook-form`은 장소·기록·일정 폼을 열 때만 받습니다.
- 사진 여러 장은 작은 슬라이드 라이브러리(Embla Carousel)로 넘기고, 이 코드는 사진이 두 장 이상인 기록을 처음 그릴 때 받습니다.
- 오프라인 캐시(`public/sw.js`): 앱 화면과 DB 조회는 네트워크를 먼저 쓰고 3.5초가 넘거나 끊기면 마지막 응답(DB는 요청 토큰의 사용자별로 따로 저장)을, 해시가 붙은 JS·CSS·글꼴과 사진은 저장해 둔 것을 먼저 씁니다. 조회는 `networkMode: 'offlineFirst'`라 오프라인에서도 서비스 워커의 응답을 받고, 저장은 `always`라 오프라인이면 바로 실패를 알립니다. 캐시 구조를 바꾸면 `VERSION`을 올려 예전 캐시를 지웁니다. E2E는 가짜 서버(`page.route`)를 거치도록 서비스 워커를 막습니다.
- 글꼴은 도현의 글자 조각(unicode-range)을 그대로 씁니다. 화면마다 8~9조각(20~50KB)만 받아, 한 파일(한글 전체 180KB)로 합치는 것보다 가볍습니다.
