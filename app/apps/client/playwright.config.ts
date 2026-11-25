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
/**
 * Every other port a run uses, as an offset from TEST_PORT: one row each, so
 * two features never take the same port (T-206: the LAN stand-in and the fake
 * audio server both took +1, and music.spec failed with EADDRINUSE). Keep the
 * offsets under 10: a Superfactory worktree owns ten ports from $PORT, so a run
 * on TEST_PORT=$PORT stays inside its own range (task builds use 3100+n and
 * 4100+n, out of the way of those ranges).
 */
const PORT_OFFSETS = {
  // The server's LAN stand-in (see apps/server/src/utils/testLanListener.ts).
  lan: 1,
  // The desktop app's audio server stand-in (fake-audio-server.ts).
  fakeAudio: 2,
  // The church's signaling relay stand-in (fake-signaling-relay.ts).
  fakeRelay: 3,
  // The self-hosted cloud sync service (sync-service.ts, T-171).
  syncService: 4,
} as const
const derivedPort = (name: keyof typeof PORT_OFFSETS) =>
  Number(TEST_PORT) + PORT_OFFSETS[name]

export const TEST_LAN_PORT =
  process.env.TEST_LAN_PORT ?? String(derivedPort('lan'))
// The test server frees its port on start (killProcessOnPort), so there it
// would kill the installed app or the dev server.
if ([TEST_PORT, TEST_LAN_PORT].some((p) => p === '3000' || p === '3001')) {
  throw new Error(
    `TEST_PORT=${TEST_PORT} is the installed app / dev server: pick another`,
  )
}
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`
/**
 * Where the test server looks for the desktop app's audio server: the music
 * spec starts a stand-in there, so music really "plays" (fake-audio-server.ts).
 */
export const FAKE_AUDIO_PORT = derivedPort('fakeAudio')

/** Where the test server finds the signaling relay (remote access, CH-050). */
export const FAKE_RELAY_URL = `http://127.0.0.1:${derivedPort('fakeRelay')}`

/** Where the cloud sync spec runs churchhub-backend's sync service. */
export const SYNC_SERVICE_PORT = derivedPort('syncService')

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
// No shell syntax beyond `&&` (cmd.exe has it too): the suite runs on
// macOS, Windows and Linux before every release. Env and cwd go through
// webServer's own options.
const serveBuiltClient = 'bun run apps/server/src/index.ts'
const webServerCommand = isCI
  ? serveBuiltClient
  : `bun run --cwd apps/client build && ${serveBuiltClient}`

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
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
        // The server's LAN stand-in, by a name the app doesn't take for
        // localhost (e2e/helpers/lan-address.ts).
        launchOptions: {
          args: [`--host-resolver-rules=MAP church-hub-lan.test 127.0.0.1`],
        },
      },
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
    cwd: join(ROOT_DIR, '../..'),
    env: {
      NODE_ENV: 'production',
      CLIENT_DIST_PATH: 'apps/client/dist',
      DATABASE_PATH: TEST_DB_PATH,
      PORT: TEST_PORT,
      // Loopback only: a test server opens no LAN port, so Windows raises no
      // firewall prompt (T-193). LAN specs use the stand-in port instead.
      CHURCH_HUB_LISTEN_HOST: '127.0.0.1',
      CHURCH_HUB_TEST_LAN_PORT: TEST_LAN_PORT,
      // Song-source specs share links from a stand-in S3 on 127.0.0.1;
      // every other private address stays refused.
      CHURCH_HUB_ALLOW_LOOPBACK_LINKS: 'true',
      // Tests start the song-source checks they need (no network at start).
      CHURCH_HUB_SONG_UPDATES_AT_START: 'false',
      CHURCH_HUB_AUDIO_SERVER_PORT: String(FAKE_AUDIO_PORT),
      CHURCH_HUB_SIGNALING_URL: FAKE_RELAY_URL,
    },
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
