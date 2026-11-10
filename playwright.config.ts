import { defineConfig, devices } from '@playwright/test';

// 프로덕션 빌드로 검사합니다. 서버 대신 e2e/fake-backend.ts(e2e/fake-server.ts)가 응답합니다.
// 다른 프로젝트가 4173을 쓰고 있으면 E2E_PORT로 바꿉니다.
const PORT = process.env.E2E_PORT ?? '4173';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  // 서비스 워커가 요청을 가로채면 가짜 서버(page.route)를 지나치므로 막습니다.
  use: { baseURL: `http://localhost:${PORT}/`, trace: 'retain-on-failure', serviceWorkers: 'block' },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `pnpm run build && pnpm run preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: `http://localhost:${PORT}/fake-supabase`,
      VITE_SUPABASE_ANON_KEY: 'e2e',
      VITE_KAKAO_MAP_KEY: 'e2e',
    },
  },
});
