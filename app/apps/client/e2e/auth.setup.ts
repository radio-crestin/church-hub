import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { expect, test as setup } from '@playwright/test'

import { STORAGE_STATE } from '../playwright.config'

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
  const superAdmin = data.find((u) => u.isSuperAdmin) ?? data[0]
  expect(superAdmin, 'a super admin user should exist after bootstrap').toBeTruthy()

  const loginRes = await request.post('/api/auth/login', {
    data: { userId: superAdmin.id },
  })
  expect(loginRes.ok()).toBeTruthy()

  mkdirSync(dirname(STORAGE_STATE), { recursive: true })
  await request.storageState({ path: STORAGE_STATE })
})
