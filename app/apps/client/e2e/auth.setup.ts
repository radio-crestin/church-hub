import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  type APIRequestContext,
  request as apiRequest,
  devices,
  expect,
  test as setup,
} from '@playwright/test'

import { TEST_SERVERS } from '../playwright.config'

/** No cookies yet: this is where the sessions are made. */
const SIGNED_OUT = { cookies: [], origins: [] }

interface LocalUser {
  id: number
  name: string
  isSuperAdmin: boolean
  hasPassword: boolean
}

/**
 * Establishes a signed-in session as the bootstrapped super admin on every
 * worker's test server and saves it to that server's storage state. Because
 * the server no longer auto-trusts localhost, every test (page and request
 * fixtures) reuses this session via `storageState`.
 *
 * The super admin is created passwordless on a fresh database, and passwordless
 * login is allowed from localhost — so this works without any seeded password.
 */
setup('authenticate as super admin', async () => {
  await Promise.all(
    TEST_SERVERS.map(async (server) => {
      const chromium = await apiRequest.newContext({
        baseURL: server.baseURL,
        storageState: SIGNED_OUT,
      })
      await signInAsSuperAdmin(chromium, server.databasePath)
      // A fresh test database waits for its first-run onboarding, which would
      // stand in front of every page spec; the onboarding spec brings it back.
      const onboardingRes = await chromium.post('/api/settings/app_settings', {
        data: { key: 'onboarding_pending', value: 'false' },
      })
      expect(onboardingRes.ok()).toBeTruthy()
      await saveSession(chromium, server.storageState)

      // The server gives WebKit a different cookie than Chromium (see
      // buildUserAuthCookie), so the WebKit project signs in as WebKit does
      // and keeps exactly the cookie a WebKit page would be given. A cookie
      // WebKit refuses then fails the WebKit specs instead of hiding behind a
      // copy.
      const webkit = await apiRequest.newContext({
        baseURL: server.baseURL,
        storageState: SIGNED_OUT,
        userAgent: devices['Desktop Safari'].userAgent,
      })
      await signInAsSuperAdmin(webkit, server.databasePath)
      await saveSession(webkit, server.webkitStorageState)
    }),
  )
})

async function signInAsSuperAdmin(
  request: APIRequestContext,
  databasePath: string,
): Promise<void> {
  const usersRes = await request.get('/api/auth/local-users')
  expect(usersRes.ok()).toBeTruthy()

  const { data } = (await usersRes.json()) as { data: LocalUser[] }
  const superAdmin = data.find((u) => u.isSuperAdmin)

  // No falling back to whoever happens to be first. A test database that has
  // accumulated users across runs can list a limited account ahead of the
  // owner, and signing in as that one still succeeds — passwordless login is
  // allowed from localhost. The session is then perfectly valid and simply
  // cannot write, so reads keep passing while every write in the suite comes
  // back 403: hundreds of unrelated specs fail and none of them says why.
  expect(
    superAdmin,
    'no super admin in the test database — it has drifted from a fresh seed. ' +
      `Stop any leftover server on the test port, then move ${databasePath} ` +
      '(with -wal and -shm) aside; it reseeds on the next run.',
  ).toBeTruthy()

  const loginRes = await request.post('/api/auth/login', {
    data: { userId: (superAdmin as LocalUser).id },
  })
  expect(loginRes.ok()).toBeTruthy()
}

async function saveSession(
  request: APIRequestContext,
  path: string,
): Promise<void> {
  mkdirSync(dirname(path), { recursive: true })
  await request.storageState({ path })
  await request.dispose()
}
