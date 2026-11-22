# 개발 가이드

NGMG-web의 코드를 처음 보는 프론트엔드 개발자를 위한 안내입니다. 코드 파일마다 맨 위에 "이 파일이 하는 일"을 적어 두었고, 줄마다 쉬운 주석을 달았으니 이 문서로 큰 그림을 잡은 뒤 파일을 열어 보세요.

## 1. 한눈에 보기

- **무엇을 만드나요?** 낚시 일정·기록·도감, 통계 등을 관리하는 웹 앱입니다. 두 사람이 함께 사용하며, Supabase를 DB로 씁니다.
- **어떻게 구성하나요?** FSD(Feature-Sliced Design) 구조를 따릅니다. 한 화면에서만 쓰는 코드는 그 화면 슬라이스에 두고, 두 곳 이상에서 쓰게 되면 features·widgets로 올립니다.
- **어디서 돌아요?** GitHub Pages(https://ngmg.kr/)에 배포됩니다. GitHub Actions가 검사한 뒤 배포합니다.
- **쓰는 기술:** Vite · React 19 · TypeScript · Tailwind CSS 4 · Supabase(PostgREST) · TanStack Query · react-hook-form
- **검사 도구:** ESLint(jsx-a11y) · Steiger · Vitest + Testing Library · Playwright + axe

## 2. 폴더 구조

```
src/
├─ app/                   주소별 화면(기본 HTML 구조는 layout.tsx, globals.css)
│  ├─ splash.tsx          첫 화면 로고
│  ├─ login/              로그인 폼(POST /api/session)
│  ├─ map/                지도·장소 목록
│  ├─ schedule/           일정 관리
│  ├─ records/            기록 목록·추가
│  ├─ guide-stats/        도감·통계
│  └─ settings/           설정(테마, 알림, 장치 정보)
├─ shared/                두 화면 이상에서 쓰는 코드
│  ├─ lib/                공통 라이브러리(로그인, 날짜, 설정 저장)
│  └─ ui/                 공통 UI(단추, 입력칸, 스피너)
├─ features/              FSD 특성 레이어(한 기능의 폼·리스트 등)
│  ├─ place-form/
│  ├─ record-form/
│  └─ ...
├─ widgets/               FSD 위젯 레이어(화면 단위로 다시 조합)
│  ├─ map-layout.tsx
│  └─ ...
└─ pages/                 FSD 페이지 레이어(화면별 진입점, react-router 대신 History API)
   ├─ splash.tsx
   ├─ login/
   ├─ map/
   ├─ schedule/
   ├─ records/
   ├─ guide-stats/
   └─ settings/

e2e/                      Playwright 시험, 가짜 서버
public/                   정적 파일(아이콘, 아이콘 폰트)
scripts/                  빌드 보조(spa-pages.mjs 등)
```

## 3. 데이터 흐름

**읽기(누구나)**

```
Supabase DB ──api 서버─────────────> 화면(사용자)
             ──postgrest-js 클라이언트──> React Query로 캐시
```

- Supabase는 RLS(Row Level Security)가 데이터 접근을 보호합니다.
- 로그인은 작은 클라이언트로, 저장소는 서명 주소·올리기·요청을 직접 보냅니다.

**쓰기(로그인한 멤버만)**

```
화면(사용자) ──form 제출──> API 라우트 ──Supabase DB
                             └─검사 → RLS 정책 확인
```

- `members.role`이 `guest`인 계정은 읽기만 할 수 있습니다.
- `member`는 쓰기 정책을 통과해야 합니다.

**오프라인 대기열**

```
 오프라인에서 저장 ──IndexedDB 대기열(outbox.ts)──> useRecordOutbox가 다시 올림
```

- 오프라인에서 저장한 기록은 `src/shared/lib/outbox.ts`의 IndexedDB 대기열에 두었다가 `useRecordOutbox`가 다시 올립니다.

## 4. 화면 구성

### splash.tsx (첫 화면)
- 로고와 앱 이름을 보여 줍니다.
- 사용자를 `/login` 또는 `/map`으로 이동시킵니다.

### login/ (로그인)
- 사용자 이메일과 비밀번호로 로그인합니다.
- POST `/api/session`으로 요청을 보냅니다.

### map/ (지도)
- Kakao 지도를 표시합니다.
- 장소 목록을 보여 줍니다.

### schedule/ (일정)
- 낚시 일정을 등록·수정·삭제합니다.
- 날짜, 장소, 함께하는 사람 등을 기록합니다.

### records/ (기록)
- 낚시 기록을 등록·수정·삭제합니다.
- 날짜, 장소, 물고기 종류와 마릿수 등을 기록합니다.

### guide-stats/ (도감·통계)
- 낚시 도감을 보여 줍니다.
- 통계 화면에서 어복 확률, 조사별 출조 횟수 등을 확인합니다.

### settings/ (설정)
- 테마(라이트/다크)를 변경합니다.
- 알림 설정을 관리합니다.

## 5. 코드 규칙

### TypeScript strict
- `any`·`as` 단언·`@ts-ignore`를 피합니다.
- 외부 입력(API 응답, 폼, URL)은 Zod 등으로 검증합니다.

### FSD 구조
- 한 화면에서만 쓰는 코드는 그 화면 슬라이스에 둡니다.
- 두 곳 이상에서 쓰게 되면 `features/`, `widgets/`로 올립니다.

### Supabase
- `supabase-js` 대신 DB 클라이언트(`postgrest-js`)만 씁니다.
- 로그인은 작은 클라이언트로, 저장소는 서명 주소·올리기·요청을 직접 보냅니다.

### 사진
- 올릴 때 긴 변 1600px 원본과 480px 썸네일(`*.thumb.jpg`)을 함께 저장합니다.

### 라이브러리
- 경량화를 위해 필요할 때만 추가합니다.
- 날짜 계산은 `Date`·`Intl`로 직접 만듭니다.

### 접근성 (WCAG 2.2 · KWCAG 2.2)
- 네이티브 HTML 요소(`<button type="button">`, `<a href>`)를 먼저 씁니다.
- 모든 기능은 키보드로 조작할 수 있어야 합니다.
- `outline: none` 단독 금지, `:focus-visible` 외곽선을 보여 줍니다.
- 텍스트 대비 4.5:1 이상(큰 글자 3:1).
- `aria-*`를 올바르게 씁니다.

### 키보드 조작
- 모든 기능을 키보드로 쓸 수 있어야 합니다.
- 네이티브 HTML 요소(`<button>`, `<a href>`)를 사용합니다.
- `outline: none` 단독 금지, `:focus-visible` 외곽선을 보여 줍니다.
- 입력칸마다 레이블(placeholder만으로 대체 금지), 오류는 `aria-invalid`와 `aria-describedby`로 연결합니다.

## 6. 테스트

- Testing Library 원칙: 구현이 아니라 사용자가 보는 동작을 검사하고, 요소는 `getByRole`로 찾습니다.
- 단위·컴포넌트 테스트는 Vitest, 화면 흐름은 Playwright E2E, 접근성은 axe를 씁니다.
- 버그를 고치면 고치기 전에 실패하는 테스트를 함께 넣습니다.

## 7. 배포

GitHub Pages(https://ngmg.kr/)에 배포합니다.

```bash
# 로컬에서 빌드와 검사
pnpm build

# PR 전에 모든 검사 돌리기
pnpm typecheck
pnpm lint
pnpm test:e2e

# main에 병합되면 GitHub Actions가 배포합니다
```

### 릴리스

1. PR 안에서 `package.json`의 `version`과 `CHANGELOG.md`의 새 절(`## x.y.z - 날짜`)을 함께 고칩니다.
2. merge 뒤 Deploy가 끝나고 사이트를 확인하면 `vX.Y.Z` 태그를 만들어 올립니다.

   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

## 8. 환경 변수

`.env.example`을 `.env.local`로 복사해 채웁니다.

| 변수 | 용도 |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase 연결. 없으면 앱이 시작되지 않습니다. |
| `VITE_KAKAO_MAP_KEY` | Kakao 지도·장소 검색. 없으면 지도와 검색만 동작하지 않습니다. |
