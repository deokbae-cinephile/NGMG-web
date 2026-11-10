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

// 글꼴 CSS의 옛 형식(woff) 대체 경로를 뺍니다. 지원하는 모든 브라우저가 woff2를 읽어 쓰이지 않고 CSS만 커집니다.
const woff2Only = (): Plugin => ({
  name: 'ngmg-woff2-only',
  apply: 'build',
  generateBundle(_, bundle) {
    for (const [name, file] of Object.entries(bundle)) {
      if (file.type !== 'asset') continue;
      if (name.endsWith('.woff')) delete bundle[name];
      else if (name.endsWith('.css')) file.source = String(file.source).replace(/,\s*url\([^)]*\.woff\)\s*format\(["']woff["']\)/g, '');
    }
  },
});

export default defineConfig(({ mode }) => ({
  base: '/', // GitHub Pages 사용자 도메인(ngmg.kr)의 루트
  plugins: [woff2Only(), react(), tailwindcss(), mode === 'demo' && demo()],
  define:
    mode === 'demo'
      ? {
          'import.meta.env.VITE_SUPABASE_URL': 'globalThis.__DEMO_API__',
          'import.meta.env.VITE_SUPABASE_ANON_KEY': '"demo"',
          'import.meta.env.VITE_KAKAO_MAP_KEY': '"demo"',
        }
      : {},
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // 작은 글꼴 조각을 CSS에 base64로 넣으면 첫 화면이 모든 조각을 한꺼번에 받습니다. 글꼴은 파일로 두어 필요한 조각만 받게 합니다.
  build: { assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined) },
}));
