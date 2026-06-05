import { setDefaultResultOrder } from 'node:dns'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// Resolve `localhost` to 127.0.0.1 (the server binds IPv4 0.0.0.0; Node ≥17
// would otherwise try ::1 first and fail). We must use the literal hostname
// `localhost` — NOT 127.0.0.1 — because the session cookie is `Secure`
// (see buildAuthCookie in apps/server/src/index.ts) and Playwright's request
// fixture only treats the hostname `localhost` as a secure context: a Secure
// cookie is stored but never sent to http://127.0.0.1, which downgrades every
// test to the read-only localhost role and 403s all writes.
setDefaultResultOrder('ipv4first')

const ROOT_DIR = dirname(fileURLToPath(import.meta.url))

// Shared signed-in session (super admin). The setup project below logs in
// once and saves the cookie here; every test reuses it so both the `page`
// and `request` fixtures are authenticated.
export const STORAGE_STATE = join(ROOT_DIR, 'e2e/.auth/super-admin.json')

const TEST_PORT = process.env.TEST_PORT ?? '3000'
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`

// Run tests against an isolated, freshly-seeded database so they neither
// depend on nor mutate the developer's real dev DB (which may, for example,
// have a password set on the super admin — which would break the test login).
const TEST_DB_PATH = join(ROOT_DIR, 'e2e/.test-data/app.db')

// In CI, serve the pre-built client directly instead of proxying to Vite
const isCI = !!process.env.CI
const webServerCommand = isCI
  ? `cd ../.. && NODE_ENV=production CLIENT_DIST_PATH=apps/client/dist DATABASE_PATH='${TEST_DB_PATH}' PORT=${TEST_PORT} bun run apps/server/src/index.ts`
  : `cd ../.. && DATABASE_PATH='${TEST_DB_PATH}' PORT=${TEST_PORT} bun run dev:web`

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
    // Logs in as the super admin and stores the session for every other test.
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
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
