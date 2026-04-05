import { defineConfig, devices } from '@playwright/test'

const TEST_PORT = process.env.TEST_PORT ?? '3000'
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`

// In CI, serve the pre-built client directly instead of proxying to Vite
const isCI = !!process.env.CI
const webServerCommand = isCI
  ? `cd ../.. && NODE_ENV=production CLIENT_DIST_PATH=apps/client/dist PORT=${TEST_PORT} bun run apps/server/src/index.ts`
  : `cd ../.. && PORT=${TEST_PORT} bun run dev:web`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'github' : 'html',
  timeout: 30000,
  use: {
    baseURL: TEST_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: TEST_BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 180000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
