import { defineConfig, devices } from '@playwright/test';

// 프로덕션 빌드로 검사합니다. 서버 대신 e2e/fake-backend.ts가 응답합니다.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173/NGMG-web/', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'pnpm run build && pnpm run preview --port 4173 --strictPort',
    url: 'http://localhost:4173/NGMG-web/',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:4173/fake-supabase',
      VITE_SUPABASE_ANON_KEY: 'e2e',
      VITE_KAKAO_MAP_KEY: 'e2e',
    },
  },
});
