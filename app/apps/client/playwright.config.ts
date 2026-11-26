import { setDefaultResultOrder } from 'node:dns'
import { availableParallelism } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

import { PORT_OFFSETS, PORTS_PER_SERVER } from './e2e/helpers/server-ports'

// Resolve `localhost` to 127.0.0.1 (the server binds IPv4 0.0.0.0; Node ≥17
// would otherwise try ::1 first and fail). We must use the literal hostname
// `localhost` — NOT 127.0.0.1 — because the session cookie is `Secure`
// (see buildAuthCookie in apps/server/src/index.ts) and Playwright's request
// fixture only treats the hostname `localhost` as a secure context: a Secure
// cookie is stored but never sent to http://127.0.0.1, which downgrades every
// test to the read-only localhost role and 403s all writes.
setDefaultResultOrder('ipv4first')

const ROOT_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * One test server per worker (T-xxx "fast e2e"). The server holds ONE global
 * presentation state broadcast to every client, so two specs presenting
 * content on the same server stomp on each other. Giving every worker its own
 * server, database and ports isolates that state, so the suite runs in
 * parallel. Override the count with E2E_WORKERS; `--workers` above it fails.
 */
export const SERVER_COUNT = Number(
  process.env.E2E_WORKERS ??
    Math.min(4, Math.max(1, Math.floor(availableParallelism() / 2))),
)

// Not 3000 (the installed app) nor 3001 (the dev server). A run that landed
// on the running app drove its real projector and database ("slides appear
// with nobody presenting", T-030).
const BASE_PORT = Number(process.env.TEST_PORT ?? '3099')

/** Everything one worker's test server is reached by. */
function testServer(index: number) {
  const port = BASE_PORT + index * PORTS_PER_SERVER
  return {
    port,
    baseURL: `http://localhost:${port}`,
    lanPort: port + PORT_OFFSETS.lan,
    fakeAudioPort: port + PORT_OFFSETS.fakeAudio,
    signalingRelayUrl: `http://127.0.0.1:${port + PORT_OFFSETS.signalingRelay}`,
    syncServicePort: port + PORT_OFFSETS.syncService,
    publicAppUrl: `http://127.0.0.1:${port + PORT_OFFSETS.publicApp}`,
    // Run tests against an isolated, freshly-seeded database so they neither
    // depend on nor mutate the developer's real dev DB (which may, for
    // example, have a password set on the super admin, breaking the login).
    databasePath: join(ROOT_DIR, `e2e/.test-data/server-${index}/app.db`),
    // Shared signed-in session (super admin): the setup project logs in once
    // per server and saves the cookie here, so `page` and `request` fixtures
    // are authenticated. WebKit gets its own cookie attributes.
    storageState: join(ROOT_DIR, `e2e/.auth/super-admin-${index}.json`),
    webkitStorageState: join(
      ROOT_DIR,
      `e2e/.auth/super-admin-webkit-${index}.json`,
    ),
  }
}

export const TEST_SERVERS = Array.from({ length: SERVER_COUNT }, (_, i) =>
  testServer(i),
)
for (const server of TEST_SERVERS) {
  // The test server frees its port on start (killProcessOnPort), so there it
  // would kill the installed app or the dev server.
  const ports = [server.port, server.lanPort, server.fakeAudioPort]
  if (ports.some((p) => p === 3000 || p === 3001)) {
    throw new Error(
      `TEST_PORT=${BASE_PORT} puts a test server on 3000/3001 (the installed app / dev server): pick another`,
    )
  }
}

/** This worker's server; the runner process (no worker) sees server 0. */
const WORKER_INDEX = Number(process.env.TEST_PARALLEL_INDEX ?? '0')
if (WORKER_INDEX >= SERVER_COUNT) {
  throw new Error(
    `worker ${WORKER_INDEX} has no test server: run with --workers ≤ ${SERVER_COUNT} or raise E2E_WORKERS`,
  )
}
const SERVER = testServer(WORKER_INDEX)

export const SERVER_PORT = SERVER.port
export const TEST_DB_PATH = SERVER.databasePath
export const TEST_LAN_PORT = String(SERVER.lanPort)
/**
 * Where the test server looks for the desktop app's audio server: the music
 * spec starts a stand-in there, so music really "plays" (fake-audio-server.ts).
 */
export const FAKE_AUDIO_PORT = SERVER.fakeAudioPort
export const SERVER_BASE_URL = SERVER.baseURL
/** Where the test server finds the signaling relay (signaling-relay.ts). */
export const SIGNALING_RELAY_URL = SERVER.signalingRelayUrl

/** Where the cloud sync spec runs churchhub-backend's sync service. */
export const SYNC_SERVICE_PORT = SERVER.syncServicePort

/** Where the join spec serves the public web app; join links point there. */
export const PUBLIC_APP_URL = SERVER.publicAppUrl

/**
 * The line the server prints once the real server is bound and boot is done
 * (`=== Server Ready` in apps/server/src/index.ts). The run starts on it.
 */
export const SERVER_READY_LINE = /\[startup\] === Server Ready/

// Serve the built client from the test server. CI builds it in its own step;
// locally it is built here. Never `dev:web`: it frees port 3000 first, which
// kills the desktop app or the dev server running there.
const isCI = !!process.env.CI
// No shell syntax beyond `&&` (cmd.exe has it too): the suite runs on
// macOS, Windows and Linux before every release. Env and cwd go through
// webServer's own options.
const serveBuiltClient = 'bun run apps/server/src/index.ts'
const buildClient = 'bun run --cwd apps/client build'

/**
 * Specs that drive only the API or a script: they never open a page, so their
 * project carries no browser settings and starts no browser.
 */
const API_SPECS = /\.api\.spec\.ts$/

export default defineConfig({
  testDir: './e2e',
  // Files are spread over the workers; a file's tests run in order on one
  // worker, against that worker's own server (see SERVER_COUNT).
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: SERVER_COUNT,
  reporter: isCI ? 'github' : 'html',
  timeout: 30000,
  use: {
    baseURL: SERVER.baseURL,
    storageState: SERVER.storageState,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Logs in as the super admin on every server and stores the sessions.
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'api',
      testMatch: API_SPECS,
      dependencies: ['setup'],
    },
    {
      name: 'chromium',
      testIgnore: API_SPECS,
      use: {
        ...devices['Desktop Chrome'],
        storageState: SERVER.storageState,
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
    // stage canvas is sized by a container query, and the one for word-level
    // slide transitions, whose frame rate WebKit must hold on the projector.
    {
      name: 'webkit',
      testMatch:
        /(live-preview-aspect|preview-matches-projection|stacked-layout|slide-line-morph)\.spec\.ts/,
      use: {
        ...devices['Desktop Safari'],
        storageState: SERVER.webkitStorageState,
      },
      dependencies: ['setup'],
    },
  ],
  // One server per worker, each on its own port and database. The first
  // also builds the client when not on CI (CI builds it in its own step).
  webServer: TEST_SERVERS.map((server, index) => ({
    command:
      index === 0 && !isCI
        ? `${buildClient} && ${serveBuiltClient}`
        : serveBuiltClient,
    cwd: join(ROOT_DIR, '../..'),
    env: {
      NODE_ENV: 'production',
      CLIENT_DIST_PATH: 'apps/client/dist',
      DATABASE_PATH: server.databasePath,
      PORT: String(server.port),
      // Loopback only: a test server opens no LAN port, so Windows raises no
      // firewall prompt (T-193). LAN specs use the stand-in port instead.
      CHURCH_HUB_LISTEN_HOST: '127.0.0.1',
      // The data key sealing saved secrets goes in a file next to the test
      // database, never in the developer's keychain.
      CHURCH_HUB_SECRET_STORE: 'file',
      CHURCH_HUB_TEST_LAN_PORT: String(server.lanPort),
      // Song-source specs share links from a stand-in S3 on 127.0.0.1;
      // every other private address stays refused.
      CHURCH_HUB_ALLOW_LOOPBACK_LINKS: 'true',
      // Tests start the song-source checks they need (no network at start).
      CHURCH_HUB_SONG_UPDATES_AT_START: 'false',
      CHURCH_HUB_AUDIO_SERVER_PORT: String(server.fakeAudioPort),
      CHURCH_HUB_SIGNALING_URL: server.signalingRelayUrl,
      // Cloud sync goes to the spec's own sync service (cloud-owner,
      // public-join), never the church's real one, and its join links open
      // the spec's public app.
      CHURCH_HUB_SYNC_URL: `http://127.0.0.1:${server.syncServicePort}`,
      CHURCH_HUB_PUBLIC_APP_URL: server.publicAppUrl,
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
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
  })),
})
