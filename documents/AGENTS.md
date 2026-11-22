# AGENTS.md — ngmg-web

이 저장소는 낚시 일정·기록·도감, 통계 등을 관리하는 웹 앱입니다. 두 사람이 함께 사용하며, Supabase를 DB로 씁니다.

## 공통 규칙

- **언어:** 답변, 커밋 메시지, PR 본문, 코드 주석은 한국어로 씁니다. 코드·명령어·경로·식별자는 원래 언어로 둡니다.
- **Git:** `main`에 직접 커밋하지 않습니다. 최신 `main`에서 `feat/…`, `fix/…`, `docs/…` 같은 브랜치를 만들고 PR로 합칩니다. 커밋은 Conventional Commits(`feat: 한국어 요약`)를 따릅니다.
- **버전·기록:** Semantic Versioning(주.부.수), 변경은 `CHANGELOG.md`(Keep a Changelog)에 적습니다.
- 사용자의 진행 중인 작업을 건드리지 않고, 비밀값·`.env`를 커밋하지 않습니다.

## 명령

```bash
pnpm install          # 설치(pnpm 12, Node 24 이상)
pnpm dev              # 개발 서버
pnpm typecheck        # 타입 검사
pnpm lint             # 린트(eslint + steiger)
pnpm test:e2e         # E2E(Playwright, axe 접근성 검사 포함)
pnpm build            # 운영 빌드(tsc + vite + spa-pages)
```

PR 전에 `typecheck`, `lint`, `test:e2e`, `build`를 로컬에서 돌립니다.

## 구조

```
src/
├─ app/               주소별 화면(기본 HTML 구조는 layout.tsx, globals.css)
│  ├─ splash.tsx      첫 화면 로고
│  ├─ login/          로그인 폼(POST /api/session)
│  ├─ map/            지도·장소 목록
│  ├─ schedule/       일정 관리
│  ├─ records/        기록 목록·추가
│  ├─ guide-stats/    도감·통계
│  └─ settings/       설정(테마, 알림, 장치 정보)
├─ shared/            두 화면 이상에서 쓰는 코드
│  ├─ lib/             공통 라이브러리(로그인, 날짜, 설정 저장)
│  └─ ui/             공통 UI(단추, 입력칸, 스피너)
├─ features/          FSD 특성 레이어(한 기능의 폼·리스트 등)
│  ├─ place-form/
│  ├─ record-form/
│  └─ ...
├- widgets/           FSD 위젯 레이어(화면 단위로 다시 조합)
│  ├─ map-layout.tsx
│  └─ ...
└- pages/             FSD 페이지 레이어(화면별 진입점, react-router 대신 History API)
   ├─ splash.tsx
   ├─ login/
   ├─ map/
   ├─ schedule/
   ├─ records/
   ├─ guide-stats/
   └─ settings/

e2e/                  Playwright 시험, 가짜 서버
public/               정적 파일(아이콘, 아이콘 폰트)
scripts/              빌드 보조(spa-pages.mjs 등)
```

## 코드 규칙

- **TypeScript strict:** `any`·`as` 단언·`@ts-ignore`를 피합니다. 외부 입력은 검사 함수로 확인합니다.
- **구조:** FSD(Feature-Sliced Design)를 따르고 Steiger로 검사합니다. 한 화면에서만 쓰는 코드는 그 화면 슬라이스에 두고, 두 곳 이상에서 쓰게 되면 features·widgets로 올립니다.
- **Supabase:** `supabase-js` 대신 DB 클라이언트(`postgrest-js`)만 씁니다. 로그인은 작은 클라이언트로, 저장소는 서명 주소·올리기·요청을 직접 보냅니다.
- **사진:** 올릴 때 긴 변 1600px 원본과 480px 썸네일(`*.thumb.jpg`)을 함께 저장합니다.
- **라이브러리:** 경량화를 위해 필요할 때만 추가합니다. 날짜 계산은 `Date`·`Intl`로 직접 만듭니다.
- **키보드:** 네이티브 HTML 요소(`<button>`, `<a href>`), `outline: none` 금지, `:focus-visible` 외곽선을 보여 줍니다.
- **접근성:** 모든 기능을 키보드로 쓸 수 있어야 하고, `aria-*`를 올바르게 씁니다. 자동 검사: ESLint(jsx-a11y)와 Playwright + axe.

## 환경 변수

`.env.example`을 `.env.local`로 복사해 채웁니다. 배포할 때는 같은 이름으로 GitHub Secrets에 넣습니다.

| 변수 | 용도 |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase 연결. 없으면 앱이 시작되지 않습니다. |
| `VITE_KAKAO_MAP_KEY` | Kakao 지도·장소 검색. 없으면 지도와 검색만 동작하지 않습니다. |

세 값은 브라우저에 공개되는 값입니다. 데이터는 RLS가 보호합니다.

## 배포

GitHub Pages(https://ngmg.kr/)에 배포합니다. `.github/workflows/deploy.yml`이 **main에 푸시(병합)될 때**와 **수동 실행(`workflow_dispatch`)** 때 배포합니다. 수동 실행은 고른 브랜치의 코드를 배포하므로 main 외 브랜치로 실행하지 않습니다.

## 버전과 릴리스

1. PR 안에서 `package.json`의 `version`과 `CHANGELOG.md`의 새 절(`## x.y.z - 날짜`)을 함께 고칩니다.
2. merge 뒤 Deploy가 끝나고 사이트를 확인하면 `vX.Y.Z` 태그를 만들어 올리고, CHANGELOG의 그 절을 GitHub 릴리스 노트로 공개합니다.

   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   # CHANGELOG에서 '## X.Y.Z' 절만 잘라 임시 파일로 만든 뒤 릴리스 노트로 씁니다.
   awk '/^## X\.Y\.Z/{f=1;next} /^## /{if(f)exit} f' CHANGELOG.md > /tmp/release-notes.md
   gh release create vX.Y.Z --title vX.Y.Z --notes-file /tmp/release-notes.md --latest
   ```

## 확인 명령

```bash
gh pr checks <번호>                                         # PR의 CI 결과
gh run list --workflow Deploy -L 1                          # 최근 배포: completed / success인지
curl -s -o /dev/null -w "%{http_code}\n" https://ngmg.kr/   # 운영 사이트 200인지
gh release list -L 1                                        # 방금 버전이 Latest인지
```
