import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { PHOTO } from './e2e/fake-server.ts';

// vite build --mode demo: 서버와 키 없이 가상 데이터로 동작하는 데모를 만듭니다. (e2e/demo-setup.ts)
const demo = (): Plugin => ({
  name: 'ngmg-demo',
  transformIndexHtml: {
    order: 'pre', // 진입 스크립트를 분석하기 전에 바꿉니다.
    handler: (html) =>
      html.replace('/src/main.tsx', '/e2e/demo-entry.ts').replace('<title>낚고먹고</title>', '<title>낚고먹고 데모</title>'),
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'demo-photo.svg', source: PHOTO });
  },
});

export default defineConfig(({ mode }) => ({
  base: '/', // GitHub Pages 사용자 도메인(ngmg.kr)의 루트
  plugins: [react(), tailwindcss(), mode === 'demo' && demo()],
  define:
    mode === 'demo'
      ? {
          'import.meta.env.VITE_SUPABASE_URL': 'globalThis.__DEMO_API__',
          'import.meta.env.VITE_SUPABASE_ANON_KEY': '"demo"',
          'import.meta.env.VITE_KAKAO_MAP_KEY': '"demo"',
        }
      : {},
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
}));
