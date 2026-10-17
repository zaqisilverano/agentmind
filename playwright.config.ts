import { defineConfig, devices } from '@playwright/test';
import { E2E_ENV, E2E_PORT } from './tests/e2e/env';

const baseURL = `http://localhost:${E2E_PORT}`;

// Own Next dev server on 3100 (3000 may be in use), fallback LLM, Postgres from docker/compose.dev.yml.
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Headless Chromium has no GPU: WebGL runs on SwiftShader.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: `pnpm dev -p ${E2E_PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: E2E_ENV,
  },
});
