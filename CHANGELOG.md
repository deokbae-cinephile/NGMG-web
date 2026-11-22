# Changelog

이 프로젝트는 1.1.0부터 [시맨틱 버저닝](https://semver.org/lang/ko/)을 따릅니다. 버그 수정은 PATCH, 기능 추가는 MINOR, 호환이 깨지는 변경은 MAJOR를 올립니다.

## 2.5.2 - 2026-11-22

### 수정
- auth: 여러 탭 간 동시 토큰 갱신 요청 시 동일한 refresh_token 사용하는 문제를 개선했습니다. 요청 전후로 readStored()로 저장소 상태를 확인하여 race condition을 방지합니다.

## 2.5.1 - 2026-11-22

### 추가
- documents 폴더에 development.md, AGENTS.md, README.md, CHANGELOG.md 문서 추가

### 수정
- package.json 버전 2.5.0 → 2.5.1

## 2.5.0 - 2026-11-22