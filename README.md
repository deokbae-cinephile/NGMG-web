# NGMG-web

낚시 일정·기록·도감, 통계 등을 관리하는 웹 앱. 두 사람이 함께 사용하며, Supabase를 DB로 씁니다.

## 기술 스택

- **프레임워크:** React 19, Vite
- **스타일:** Tailwind CSS 4
- **데이터:** Supabase (PostgREST)
- **테스트:** Vitest, Playwright
- **배포:** GitHub Actions

## 프로젝트 구조

```
src/
├─ app/        앱 진입, 첫 화면 로고, 전역 스타일
├─ pages/      FSD 페이지: login, map, place, schedule, stats, dex, gear, settings
├─ widgets/    화면 단위로 조합하는 코드
├─ features/   한 기능의 폼: place-form, record-form, event-form, gear-form
├─ entities/   도메인 모델
└─ shared/     api, lib, ui, config

e2e/           Playwright 시험, 가짜 서버, 데모
public/        정적 파일, 서비스 워커
scripts/       빌드 보조
supabase/      DB 마이그레이션, Edge Function
```

## 개발 환경 설정

```bash
# pnpm이 설치되어 있어야 합니다
# Node.js: 24

# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 프로젝트 빌드
pnpm build
```

## 테스트 실행

```bash
# ESLint 검사
pnpm lint

# TypeScript 타입 검사
pnpm typecheck

# 유닛 테스트
pnpm test

# E2E 테스트
pnpm test:e2e
```
