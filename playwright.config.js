import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npm run dev:no-reload', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 120000,
  },
})
