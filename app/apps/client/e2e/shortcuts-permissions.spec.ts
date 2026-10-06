import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * T-041. A shortcut to a page the user may not view does nothing. (Where each
 * key works, only in Church Hub or from any program, is covered by
 * sidebar-keys-app-level.spec.ts.)
 */

const SIDEBAR_SETTING = '/api/settings/app_settings/sidebar_configuration'

async function bibleShortcut(request: APIRequestContext): Promise<string> {
  const response = await request.get(SIDEBAR_SETTING)
  const { data } = await response.json()
  const config = JSON.parse(data.value) as {
    items: Array<{ id: string; settings?: { shortcuts?: string[] } }>
  }
  const shortcut = config.items.find((item) => item.id === 'bible')?.settings
    ?.shortcuts?.[0]
  expect(shortcut, 'the seeded config binds a key to the Bible').toBeTruthy()
  return shortcut as string
}

test.describe('Shortcuts: permissions', () => {
  test.describe.configure({ mode: 'serial' })

  test('a page shortcut still works for a user who may view the page', async ({
    page,
    request,
  }) => {
    const shortcut = await bibleShortcut(request)
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    await page.keyboard.press(shortcut)
    await expect(page).toHaveURL(/\/bible/)
  })

  test('a page shortcut does nothing for a user who may not view the page', async ({
    browser,
    request,
  }, testInfo) => {
    const shortcut = await bibleShortcut(request)
    const create = await request.post('/api/users', {
      data: {
        name: `E2E No Bible ${Date.now()}`,
        permissions: ['songs.view'],
      },
    })
    const userId = (await create.json()).data.user.id as number
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL as string,
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()

    try {
      const login = await page.request.post('/api/auth/login', {
        data: { userId },
      })
      expect(login.ok()).toBeTruthy()
      await page.goto('/songs')
      await page.waitForLoadState('networkidle')
      await expect(page.locator('a[href="/bible"]')).toHaveCount(0)

      await page.keyboard.press(shortcut)
      await page.waitForTimeout(1000)
      await expect(page).toHaveURL(/\/songs/)
    } finally {
      await context.close()
      await request.delete(`/api/users/${userId}`)
    }
  })
})
