import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { expect, test as setup } from '@playwright/test'

import { STORAGE_STATE, WEBKIT_STORAGE_STATE } from '../playwright.config'

interface LocalUser {
  id: number
  name: string
  isSuperAdmin: boolean
  hasPassword: boolean
}

/**
 * Establishes a signed-in session as the bootstrapped super admin and saves it
 * to STORAGE_STATE. Because the server no longer auto-trusts localhost, every
 * test (page and request fixtures) reuses this session via `storageState`.
 *
 * The super admin is created passwordless on a fresh database, and passwordless
 * login is allowed from localhost — so this works without any seeded password.
 */
setup('authenticate as super admin', async ({ request }) => {
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
      'Stop any leftover server on the test port, then move ' +
      'e2e/.test-data/app.db (with -wal and -shm) aside; it reseeds on the ' +
      'next run.',
  ).toBeTruthy()

  const loginRes = await request.post('/api/auth/login', {
    data: { userId: (superAdmin as LocalUser).id },
  })
  expect(loginRes.ok()).toBeTruthy()

  mkdirSync(dirname(STORAGE_STATE), { recursive: true })
  const state = await request.storageState({ path: STORAGE_STATE })

  // The session cookie is `Secure`. Chromium sends it to http://localhost,
  // which it counts as a secure context; WebKit does not, so a WebKit page
  // would sign in afresh and never keep the cookie it is given. The WebKit
  // project gets the same session without the flag.
  writeFileSync(
    WEBKIT_STORAGE_STATE,
    JSON.stringify({
      ...state,
      cookies: state.cookies.map((cookie) => ({ ...cookie, secure: false })),
    }),
  )
})
