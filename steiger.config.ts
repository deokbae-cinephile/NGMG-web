import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

// FSD 구조 검사(https://github.com/feature-sliced/steiger).
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // features의 네 슬라이스(event-form·gear-form·place-form·record-form)는 각 엔티티를 저장하는 입력 창이라 이름에 form이 겹칩니다.
    // 묶음 폴더로 바꾸면 이름만 길어지고 얻는 것이 없어 이 규칙만 끕니다.
    rules: { 'fsd/repetitive-naming': 'off' },
  },
]);
