# AGENTS.md

## 전역 개발 규칙 (Global Rules)

### 1. 언어 및 응답 스타일
- 모든 답변, 설명, 커밋 메시지, PR 본문, 코드 주석은 한국어로 작성한다.
- 불필요한 전체 파일 탐색을 피하고 핵심 파일 위주로 최소한의 수정만 진행한다.
- 작업 완료 후 사용자에게 질문하거나 요약을 출력했다면, 추가 도구(List agents 등)를 절대 호출하지 말고 즉시 응답을 종료한다.
- 배포·CI·릴리스·PR 상태는 짐작하지 말고, 아래 "확인 명령"을 실행한 결과로만 말한다. 명령을 실행하지 못했다면 "확인하지 못했다"고 말한다.

### 2. Git 브랜치 및 PR 워크플로우 (필수)
- `main` 브랜치에 직접 커밋하거나 푸시하지 않는다. (main은 보호 규칙이 걸려 있어 `check` 검사를 통과해야만 바뀐다.)
- 모든 작업은 최신 `main`을 기준으로 새 작업 브랜치(예: `feat/...`, `fix/...`, `refactor/...`, `docs/...`, `chore/...`)를 만든 뒤 진행한다.
- 커밋 메시지는 `<타입>(<범위>): <한국어 요약>` 형식이다. 예: `feat(stats): 손맛 확률 섹션 제거`
- 작업이 끝나면 작업 브랜치를 푸시하고 `main`을 대상으로 PR을 만든다. PR 본문에는 무엇을·왜 바꿨는지와 검사 결과를 적는다.
- 병합은 squash로 한다. CI(`check`)가 통과하면 병합한다.
- `.aider*` 같은 로컬 도구 파일은 커밋하지 않는다(`.gitignore`에 있음).

### 3. 코드 품질
- 기존 프로젝트의 코드 스타일, 폴더 구조(FSD, Steiger로 검사), 타입 규칙을 엄격히 준수한다.
- 쓰지 않는 변수·import를 남기지 않는다(lint 실패 원인).

### 4. 테스트 및 검사
- PR 전에 로컬에서 CI와 같은 검사를 돌려 모두 통과시킨다.
  ```bash
  pnpm install --frozen-lockfile
  pnpm lint          # eslint + steiger
  pnpm typecheck     # tsc --noEmit
  pnpm test:e2e      # Playwright E2E(axe 접근성 검사 포함)
  pnpm build
  ```
- 이 저장소에는 단위 테스트(Vitest 등)가 없다. 화면 동작은 `e2e/`의 Playwright 테스트로 검사한다.
- 화면 문구나 구역을 바꾸거나 지우면, 그 문구·구역을 찾는 `e2e/*.spec.ts`도 함께 고친다(지난 #82 CI 실패 원인).

### 5. 버전·변경 기록
- 버전은 SemVer를 따른다. 버그 수정·작은 변경은 수(2.3.1→2.3.2), 기능 추가는 부(2.3→2.4), 호환이 깨지면 주를 올린다.
- 같은 PR 안에서 `package.json`의 `version`을 올리고, `CHANGELOG.md` 맨 위에 `## x.y.z - YYYY-MM-DD`와 바뀐 내용을 적는다.
- DB 함수·마이그레이션 변경이 있으면 CHANGELOG 해당 절 첫 줄에 필요한 파일을 적는다(기존 절 형식을 따른다).

### 6. 배포
- `.github/workflows/deploy.yml`이 **main에 푸시(병합)될 때**와 **수동 실행(`workflow_dispatch`)** 때 GitHub Pages(https://ngmg.kr/)로 배포한다. 수동 실행은 고른 브랜치의 코드를 배포하므로 main 외 브랜치로 실행하지 않는다.
- 태그·릴리스를 만들어도 배포는 일어나지 않는다. 스테이징 환경은 없다.

### 7. 병합 뒤 태그·릴리스
PR이 병합되면 아래 순서로 태그와 GitHub 릴리스를 만든다. 제목은 `v버전`, 본문은 CHANGELOG의 해당 절이다.
```bash
(
  set -euo pipefail
  PR=<PR번호>
  SHA=$(gh pr view "$PR" --json mergeCommit --jq .mergeCommit.oid)
  git fetch origin main --tags
  V=$(git show "$SHA:package.json" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version")
  git tag "v$V" "$SHA"
  git push origin "v$V"
  git show "$SHA:CHANGELOG.md" | awk -v v="$V" '$0 ~ "^## "v" " {f=1; next} /^## / && f {exit} f' > /tmp/notes.md
  gh release create "v$V" --target "$SHA" --title "v$V" --notes-file /tmp/notes.md --latest
)
```

### 8. 확인 명령
```bash
gh pr checks <번호>                                         # PR의 CI 결과
gh run list --workflow Deploy -L 1                          # 최근 배포: completed / success인지
curl -s -o /dev/null -w "%{http_code}\n" https://ngmg.kr/   # 운영 사이트 200인지
gh release list -L 1                                        # 방금 버전이 Latest인지
```

### 9. 프로젝트 정보
- **프로젝트 이름:** ngmg-web
- **버전:** `package.json`의 `version`을 본다(이 파일에 숫자를 적어 두지 않는다).
- **패키지 매니저:** pnpm(`package.json`의 `packageManager`)
- **주요 기술:** React 19, Vite, TypeScript, TanStack Query, Supabase(PostgREST), Tailwind CSS 4, Playwright
