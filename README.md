# NGMG Web - 낚고먹고

[![CI](https://github.com/deokbae-cinephile/NGMG-web/actions/workflows/ci.yml/badge.svg)](https://github.com/deokbae-cinephile/NGMG-web/actions/workflows/ci.yml)
![version](https://img.shields.io/badge/version-1.12.2-2f7bd8)

낚시 포인트와 맛집을 지도에 남기고, 출조 일정과 준비물, 조과 기록과 통계를 함께 챙기는 2인용 반응형 웹 서비스입니다.

> **프로젝트 상태:** 두 사람이 직접 쓰는 서비스로, Supabase와 Kakao 지도를 연결해 [ngmg.kr](https://ngmg.kr)에 배포했습니다. 공용 계정으로만 로그인할 수 있으며, 서버 없이 둘러보려면 `pnpm run demo`를 실행합니다.

## 화면

화면의 장소, 일정, 기록은 모두 가상 데이터입니다. 스크린샷은 가짜 서버로 찍어 지도 자리에 실제 지도 대신 가짜 배경이 보입니다.

| 지도                                                                                                     | 일정                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| <img src="docs/images/map.jpg" alt="왼쪽 지도에 낚시·맛집·기타 아이콘 핀이 있고 오른쪽에 분류·태그 필터, 정렬, 태그가 붙은 장소 목록이 있는 화면" width="480"> | <img src="docs/images/schedule.jpg" alt="왼쪽 달력과 다가오는 일정, 가운데 고른 날짜의 일정과 장비·준비물, 오른쪽 물때·날씨와 기록을 기다리는 일정이 있는 3분할 화면" width="480"> |

| 휴대폰 일정                                                                                     | 전체 기록                                                                     |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| <img src="docs/images/schedule-mobile.jpg" alt="휴대폰 폭의 달력과 선택한 날짜, 하단 아이콘 탭 메뉴" width="240"> | <img src="docs/images/records.jpg" alt="분류·태그 필터 아래 조과, 별점, 사진이 있는 기록 카드 목록" width="240"> |
| **통계**                                                                                     | **로그인**                                                                    |
| <img src="docs/images/stats.jpg" alt="연도별 출조 횟수, 전체 기록, 맛집 방문, 평균 별점과 월별 출조 막대그래프" width="240"> | <img src="docs/images/login.jpg" alt="가운데 생선 접시 로고 아래 이메일, 비밀번호 입력란" width="240"> |

## 주요 기능

| 기능     | 내용                                                                       |
| -------- | -------------------------------------------------------------------------- |
| 지도     | 무악재역 기준 핀, 마지막 위치 기억, 낚시·맛집·기타 아이콘 핀, 분류별 색의 핀 묶음, 핀 정보 말풍선, 위성 지도, 분류·태그 필터, 이름·주소·태그 검색, 이름·태그·거리·최근순 정렬 |
| 장소     | 주소·이름 검색으로 추가, 태그, 대표 사진, 메모, 길찾기, 주소 복사, 공유, 기록 요약 |
| 일정     | 달력·일정·기록 3분할 화면, 연박 일정(달력에 이어서 표시), 연도·월 바로 고르기, 공휴일·주말 색, 장소 연결, D-day, 지난 일정에서 기록 남기기 |
| 물때·날씨 | 일정 장소 기준 물때와 음력, 15일 예보(날씨, 기온, 강수, 바람, 파고)              |
| 준비물   | 날짜별 장비·준비물, 기본 목록·이전 목록 복사, 모두 선택·모두 해제·전체 삭제      |
| 기록     | 조과·별점, 잡은 물고기(조사·어종·길이·사진), 연박 날짜, 낚시(장비, 채비, 미끼, 날씨)·맛집(메뉴, 가격) 항목, 사진 10장(미리보기, 옆으로 넘겨 보기), 최근 조과 모아 보기 |
| 통계     | 연도별 출조 횟수, 맛집 방문, 낚시·맛집 평균 별점, 월별 출조, 자주 간 장소·미끼, 조사별 마릿수와 최대어 |
| 장비     | 조사별 장비 목록 추가·수정·삭제, 장비 사진 |
| 함께 쓰기 | 공용 계정 하나로 두 사람이 모든 데이터를 함께 보고 수정, 데이터 백업, 앱 설치(PWA, 바로가기·설치 미리보기) |

## 기술 스택

![React, TypeScript, Vite, Tailwind CSS, Supabase, PostgreSQL, pnpm, GitHub Actions](https://skillicons.dev/icons?i=react,ts,vite,tailwind,supabase,postgres,pnpm,githubactions)

| 구분        | 사용 기술                                                              |
| ----------- | ---------------------------------------------------------------------- |
| 프레임워크  | React 19, TypeScript, Vite (라우터·달력·날짜 계산은 직접 구현)          |
| UI          | Tailwind CSS, 네이티브 dialog, 도현(Do Hyeon)                          |
| 지도·검색   | Kakao Maps JavaScript SDK, Open-Meteo                                  |
| 상태·데이터 | TanStack Query, React Hook Form                                        |
| 서버        | Supabase (Postgres, RLS, Auth, Storage — auth-js·postgrest-js·storage-js) |
| 품질        | ESLint, Playwright, axe                                                |
| 배포        | GitHub Pages(ngmg.kr), GitHub Actions                                  |

## 시작하기

Node.js 24(`.nvmrc`)와 pnpm이 필요합니다. 서버와 키 없이 가상 데이터로 바로 써 볼 수 있습니다.

```bash
pnpm install
pnpm exec playwright install chromium
pnpm run demo
```

실서버에 연결할 때는 `.env.example`을 `.env`로 복사해 값을 채우고 `pnpm run dev`로 실행합니다.

| 명령                          | 설명                                     |
| ----------------------------- | ---------------------------------------- |
| `pnpm run demo`               | 가짜 서버로 앱 실행 (창을 닫으면 초기화) |
| `pnpm run build`              | 타입 검사와 프로덕션 빌드                |
| `pnpm run build:demo`         | 가상 데이터로 동작하는 웹 데모 빌드      |
| `pnpm run lint` / `typecheck` | ESLint / 타입 검사                       |
| `pnpm run test:e2e`           | 핵심 흐름 E2E (360·768·1280px, axe)      |
| `pnpm run shots`              | README 스크린샷 생성                     |

서버 준비와 배포 방법은 [개발 가이드](docs/development.md)를 참고하세요.

## 프로젝트 구조

```
docs/          문서, 스크린샷
e2e/           Playwright E2E, 가짜 서버, 데모
public/        아이콘, 웹 앱 매니페스트, 설치 미리보기 화면
supabase/      마이그레이션
src/
├─ app/        앱 진입, 라우팅, 전역 스타일
├─ pages/      지도, 일정, 기록, 통계, 장비, 장소 상세, 로그인
├─ widgets/    앱 틀, 장소 지도
├─ features/   로그인, 장소·기록·일정 작성, 날짜별 준비물, 데이터 백업, 앱 설치
├─ entities/   세션, 장소, 기록, 일정, 준비물, 장비, 물때·날씨
└─ shared/     Supabase 연결, Kakao SDK, 공통 UI·유틸
```

## 문서

| 문서                               | 내용                                 |
| ---------------------------------- | ------------------------------------ |
| [개발 가이드](docs/development.md) | 서버 준비, 환경 변수, 배포, 디자인 토큰 |
| [CHANGELOG](CHANGELOG.md)          | 버전 기록                            |
