import { expect, test } from '@playwright/test'

/**
 * The "New Song" button on the songs page is gated by `songs.create`:
 * a user without that permission can't see it (and the /songs/new route + the
 * POST /api/songs endpoint reject creation server-side too).
 */

const NEW_SONG = /new song|cântare nouă/i

test.describe('Song create permission', () => {
  test('super admin sees the New Song button', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: NEW_SONG })).toBeVisible({
      timeout: 10000,
    })
  })

  test('a songs.view user without songs.create cannot see or use create', async ({
    browser,
    request,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string
    const create = await request.post('/api/users', {
      data: {
        name: `E2E NoCreate ${Date.now()}`,
        permissions: ['songs.view'],
      },
    })
    const userId = (await create.json()).data.user.id as number

    const ctx = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    })
    const page = await ctx.newPage()

    try {
      // Sign in as the limited user (passwordless, allowed from localhost).
      const ok = await page.request.post('/api/auth/login', {
        data: { userId },
      })
      expect(ok.ok()).toBeTruthy()

      await page.goto('/songs')
      await page.waitForLoadState('networkidle')

      // The songs page loads (songs.view) but the New Song button is hidden.
      await expect(page.getByRole('button', { name: NEW_SONG })).toHaveCount(0)

      // The server also rejects creation for this user.
      const denied = await page.request.post('/api/songs', {
        data: { title: `E2E Denied ${Date.now()}`, slides: [] },
      })
      expect(denied.status()).toBe(403)
    } finally {
      await ctx.close()
      await request.delete(`/api/users/${userId}`)
    }
  })
})
