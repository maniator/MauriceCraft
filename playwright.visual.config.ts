import { defineConfig, devices } from '@playwright/test';

// The visual suite runs on a dedicated Vite build where MODE=visual-test.
// Production builds omit the typed fixture and its global test handle.
const url = 'http://127.0.0.1:4174/MauriceCraft/';

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: url,
    trace: 'retain-on-failure',
    colorScheme: 'light',
    locale: 'en-US',
    launchOptions: {
      args: [
        '--enable-webgl',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  projects: [
    { name: 'visual-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'visual-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build:visual && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url,
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
