import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const env = globalThis.process?.env ?? {};
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const frontendHost = env.PW_FRONTEND_HOST || 'localhost';
const frontendPort = Number(env.PW_FRONTEND_PORT || 3000);
const frontendBaseUrl = env.PW_FRONTEND_URL || `http://${frontendHost}:${frontendPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(env.CI),
  retries: env.CI ? 2 : 0,
  workers: env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host ${frontendHost} --port ${frontendPort}`,
    url: frontendBaseUrl,
    cwd: projectRoot,
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
