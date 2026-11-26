import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  test,
} from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'

/**
 * Cloud backup needs the new backend: a build whose backend is still the
 * legacy Worker (no backend set, nothing baked in) shows Church Hub Cloud as
 * not available yet and refuses to sign in, without calling any backend.
 */

const server = new ExtraServer()
let api: APIRequestContext
let context: BrowserContext

test.describe
  .serial('Church Hub Cloud on the legacy backend', () => {
    test.setTimeout(300_000)

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(300_000)
      // No CHURCH_HUB_BACKEND_URL, nothing baked in: the legacy backend.
      await server.start({ CHURCH_HUB_SONG_UPDATES_AT_START: 'false' })
      api = await server.adminRequest()
      context = await browser.newContext({
        baseURL: server.baseURL,
        storageState: { cookies: [], origins: [] },
      })
      const users = (await (
        await context.request.get('/api/auth/local-users')
      ).json()) as { data: { id: number; isSuperAdmin: boolean }[] }
      const admin = users.data.find((u) => u.isSuperAdmin)
      await context.request.post('/api/auth/login', {
        data: { userId: admin?.id },
      })
    })

    test.afterAll(async () => {
      await context?.close()
      await api?.dispose()
      await server.dispose()
    })

    test('the Cloud option says it is not available yet', async () => {
      const status = (await (await api.get('/api/backup/cloud/status')).json())
        .data
      expect(status.available).toBe(false)
      const signIn = await api.post('/api/backup/cloud/sign-in', { data: {} })
      expect(signIn.status()).toBe(409)
      expect((await signIn.json()).error).toBe('not_available')

      const page = await context.newPage()
      await page.goto('/settings/backup')
      const panel = page.getByTestId('cloud-backup-panel')
      await expect(panel.getByTestId('cloud-backup-unavailable')).toBeVisible()
      await expect(panel.getByTestId('cloud-backup-sign-in')).toHaveCount(0)
    })
  })
