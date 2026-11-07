// 배포용 데모의 진입점입니다. 가짜 서버를 먼저 준비한 뒤 앱을 불러옵니다.
// 앱은 동적으로 불러와야 합니다. 정적 import는 공통 코드 조각이 이 파일보다 먼저 실행될 수 있습니다.
import './demo-setup.ts';

await import('../src/main.tsx');
