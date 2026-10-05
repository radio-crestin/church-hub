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
/** The same account signed in as WebKit, which gets its own cookie attributes. */
export const WEBKIT_STORAGE_STATE = join(
  ROOT_DIR,
  'e2e/.auth/super-admin-webkit.json',
)

// Not 3000 (the installed app) nor 3001 (the dev server). A run that landed
// on the running app drove its real projector and database ("slides appear
// with nobody presenting", T-030).
const TEST_PORT = process.env.TEST_PORT ?? '3099'
// The test server frees its port on start (killProcessOnPort), so there it
// would kill the installed app or the dev server.
if (TEST_PORT === '3000' || TEST_PORT === '3001') {
  throw new Error(
    `TEST_PORT=${TEST_PORT} is the installed app / dev server: pick another`,
  )
}
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`

/**
 * The line the server prints once the real server is bound and boot is done
 * (`=== Server Ready` in apps/server/src/index.ts). The run starts on it.
 */
export const SERVER_READY_LINE = /\[startup\] === Server Ready/

// Run tests against an isolated, freshly-seeded database so they neither
// depend on nor mutate the developer's real dev DB (which may, for example,
// have a password set on the super admin — which would break the test login).
const TEST_DB_PATH = join(ROOT_DIR, 'e2e/.test-data/app.db')

// Serve the built client from the test server. CI builds it in its own step;
// locally it is built here. Never `dev:web`: it frees port 3000 first, which
// kills the desktop app or the dev server running there.
const isCI = !!process.env.CI
const serveBuiltClient = `cd ../.. && NODE_ENV=production CLIENT_DIST_PATH=apps/client/dist DATABASE_PATH='${TEST_DB_PATH}' PORT=${TEST_PORT} bun run apps/server/src/index.ts`
const webServerCommand = isCI
  ? serveBuiltClient
  : `bun run build && ${serveBuiltClient}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Single worker locally too (CI already does this). The server holds ONE
  // global presentation state broadcast to every client, so tests that present
  // content (bible verses, songs, presenter remote) cross-talk when run on
  // parallel workers — a verse presented by one spec stomps the presented state
  // another spec's /bible page is mirroring. Serial execution makes the suite
  // deterministic. Override with `--workers=N` for faster (but racy) local runs.
  workers: 1,
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
    // The macOS desktop app draws with WebKit, which has laid the previews out
    // differently from Chromium before (a preview box taller than its frame,
    // cutting the lyrics off). The specs that hold the previews to the
    // projection run there too, and so does the one for stacked panels, whose
    // stage canvas is sized by a container query.
    {
      name: 'webkit',
      testMatch:
        /(live-preview-aspect|preview-matches-projection|stacked-layout)\.spec\.ts/,
      use: { ...devices['Desktop Safari'], storageState: WEBKIT_STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: webServerCommand,
    // Ready when OUR server says so, not when an HTTP probe of the URL
    // answers: Playwright's probe (and its "port already used" pre-check) has
    // no socket timeout, so one request that never gets an answer stalled the
    // whole start for the full timeout while the server was long ready (T-056).
    // Whatever else held the port is gone by then: the server frees its port
    // before binding, so the suite never drives a server it did not start.
    wait: { stdout: SERVER_READY_LINE },
    reuseExistingServer: false,
    timeout: 180000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
