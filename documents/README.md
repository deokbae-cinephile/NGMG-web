# NGMG-web

낚시 일정·기록·도감, 통계 등을 관리하는 웹 앱입니다. 두 사람이 함께 사용하며, Supabase를 DB로 씁니다.

- 일정: 낚시 일정 등록·수정·삭제
- 기록: 낚시 기록 등록·수정·삭제, 물고기 도감
- 통계: 조사별 출조 횟수와 어복 확률
- 지도: Kakao 지도로 장소 확인
- 설정: 테마(라이트/다크), 알림 설정

- 주소: https://ngmg.kr/
- 개발 안내: [개발 가이드](development.md)
- 작업 규칙: [AGENTS.md](../AGENTS.md)

## 시작하기

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

## 키보드 조작

| 화면 | 키 |
|---|---|
| 목록 | ▲▼ 항목 고르기 · ◀▶ 이전·다음 · Home·End 처음·끝 · Enter 열기 |
| 입력칸 | Tab 다음 항목 |

## 접근성

- 네이티브 HTML 요소(`<button type="button">`, `<a href>`)를 사용합니다.
- 모든 기능을 키보드로 조작할 수 있습니다.
- `:focus-visible` 외곽선을 보여 줍니다.

## 환경 변수

`.env.example`을 `.env.local`로 복사해 채웁니다.

| 변수 | 용도 |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase 연결. 없으면 앱이 시작되지 않습니다. |
| `VITE_KAKAO_MAP_KEY` | Kakao 지도·장소 검색. 없으면 지도와 검색만 동작하지 않습니다. |

## 배포

GitHub Pages(https://ngmg.kr/)에 배포합니다. main에 병합되면 GitHub Actions가 검사한 뒤 배포합니다.

```bash
pnpm build        # 로컬에서 빌드와 검사
```

## 버전과 릴리스

1. PR 안에서 `package.json`의 `version`과 `CHANGELOG.md`의 새 절(`## x.y.z - 날짜`)을 함께 고칩니다.
2. merge 뒤 배포가 완료되면 `vX.Y.Z` 태그를 만들어 올립니다.

   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
