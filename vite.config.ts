import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/NGMG-web/', // GitHub Pages 프로젝트 사이트 경로
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', setupFiles: './src/shared/lib/test-setup.ts', include: ['src/**/*.test.{ts,tsx}'] },
});
