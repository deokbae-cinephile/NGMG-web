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
| `pnpm run build:demo` | 정적 파일로 빌드합니다. `e2e/demo-setup.ts`가 브라우저의 `fetch`를 가로채 응답하고, 날씨는 실제 Open-Meteo를 부릅니다. 고친 데이터는 탭을 닫기 전까지 sessionStorage에 남습니다. |

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

## Kakao 지도 준비

1. [Kakao Developers](https://developers.kakao.com)에서 앱을 만들고 **카카오맵** 사용을 켭니다.
2. **플랫폼 > Web**에 `http://localhost:5173`과 `https://deokbae-cinephile.github.io`를 등록합니다.
3. **JavaScript 키**를 `VITE_KAKAO_MAP_KEY`에 넣습니다.

## 배포 (GitHub Pages)

1. 저장소 Pages의 Source는 **GitHub Actions**로 설정되어 있습니다.
2. **Settings > Secrets and variables > Actions**에 위 환경 변수 3개를 넣습니다. 3개가 모두 없으면 `deploy.yml`이 웹 데모(`build:demo`)를 배포하고, 일부만 있으면 실패합니다.
3. `main`에 올리거나 **Actions > Deploy**를 다시 실행하면 배포됩니다. 주소는 `https://deokbae-cinephile.github.io/NGMG-web/`입니다.

저장소 이름이나 도메인이 바뀌면 `vite.config.ts`의 `base`도 함께 바꿉니다. 새로고침을 지원하려고 빌드할 때 `index.html`을 `404.html`로 복사합니다.

## 테스트

| 종류 | 위치 | 비고 |
| --- | --- | --- |
| E2E | `e2e/app.spec.ts` | 핵심 흐름 8개를 프로덕션 빌드로 360·768·1280px에서 검사합니다. 넘침과 axe 접근성 검사를 포함합니다. |

프로젝트를 가볍게 두려고 단위 테스트와 DB 권한 테스트는 두지 않습니다. E2E의 Supabase와 Kakao SDK는 `e2e/fake-backend.ts`가 흉내 냅니다. 실제 서비스와의 연동은 검증하지 않으므로, 서버를 연결한 뒤에는 직접 확인합니다.

## 물때와 날씨

- 날씨와 파고는 키가 필요 없는 Open-Meteo를 브라우저에서 직접 호출합니다. 이때 일정 장소의 좌표가 Open-Meteo로 전달됩니다.
- 물때는 브라우저의 음력 달력(`Intl` 단기력)으로 계산한 어림값입니다. 실제 조석표를 대신하지 않습니다.

## 현재 위치

지도의 "현재 위치에서 가까운 순"을 누를 때만 브라우저에 위치를 묻습니다. 위치는 화면의 정렬과 직선거리 표시에만 쓰고, 저장하거나 서버로 보내지 않습니다.

## 데이터 백업

기록 화면의 "데이터 백업"은 장소, 기록, 사진 목록, 일정, 준비물을 JSON 파일로 저장합니다. 사진 파일 자체는 포함되지 않습니다. 파일을 불러오는 기능은 없으므로 복원이 필요하면 Supabase에 직접 넣습니다.

## 쿠키

`js-cookie`는 지도 위치(`map-view`)와 분류 필터(`map-filter`, `records-filter`) 같은 화면 설정만 저장합니다. 로그인 세션은 Supabase가 localStorage에 관리합니다.

## 디자인 토큰

`src/app/styles.css`의 `@theme`에 있습니다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `ink` / `night` | `#030302` / `#0b0a08` | 배경 / 패널 |
| `paper` / `cream` | `#daceb0` / `#fdf4df` | 스티커·주요 버튼 / 본문 |
| `tape` | `#e0b02c` | 테이프 장식, 초점, 선택 상태 |
| `muted` | `#a89f87` | 보조 글자 |
| `fishing` / `restaurant` | `#8fc7d9` / `#f0a07a` | 분류. 색 외에 글자와 모양으로도 구분합니다. |

레퍼런스: [Nocturnal Dream](https://www.nocturnaldream.com/)의 분위기만 참고했고, 그림과 유료 폰트는 쓰지 않습니다.

| 토큰 | 값 | 쓰임 |
| --- | --- | --- |
| `paper` / `surface` | `#fafafa` / `#f0f0f0` | 바탕 / 입력란·강조 영역 |
| `ink` / `muted` | `#0a0a0a` / `#595959` | 본문 글자·제목 밑줄 / 보조 글자·라벨 |
| `line` / `field` | `#d4d4d4` / `#8c8c8c` | 구분선 / 입력란 테두리 |
| `accent` / `accent-ink` | `#2f7bd8` / `#1f5fb4` | 가는 선·점·초점 표시 / 파란 글자(오늘 날짜) |
| `danger` | `#b3221e` | 삭제·오류 |

화면 제목은 `.page-title`(가로선 위의 큰 글자)과 그 위의 `.eyebrow`(자간을 넓힌 작은 라벨)로 씁니다. 장소 분류는 색 대신 채움으로 구분합니다(낚시: 테두리, 맛집: 검정 채움).

장식용 애니메이션과 추가 글꼴은 쓰지 않습니다. 화면이 가볍게 유지되도록 도현(Do Hyeon) 하나와 색·선·여백으로만 표현합니다. 도현은 `@fontsource/do-hyeon`으로 앱에 포함하며, 한글이 93개 조각으로 나뉘어 화면에 쓰인 조각만 받습니다. 굵기가 하나뿐이라 `font-synthesis: none`으로 가짜 굵게를 막습니다.
