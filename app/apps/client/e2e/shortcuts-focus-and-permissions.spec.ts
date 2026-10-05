import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * T-041. Two things about keyboard shortcuts:
 *  - Settings → Shortcuts has an "only when Church Hub is in front" switch.
 *    The desktop shell then lets presentation / livestream / OBS keys (F1–F12)
 *    go to the program in front (e.g. BibleShow) instead of catching them
 *    while minimised. Off by default, so nothing changes unless chosen. Which
 *    keys the shell holds is covered by useGlobalAppShortcuts.test.tsx; a
 *    browser cannot press OS-wide keys.
 *  - A shortcut to a page the user may not view does nothing.
 */

const SHORTCUTS_SETTING = '/api/settings/app_settings/global_keyboard_shortcuts'
const SIDEBAR_SETTING = '/api/settings/app_settings/sidebar_configuration'
const FOCUS_ONLY_SWITCH =
  /only when church hub is in front|doar când church hub/i

async function savedShortcuts(request: APIRequestContext) {
  const response = await request.get(SHORTCUTS_SETTING)
  if (!response.ok()) return null
  const { data } = await response.json()
  return data?.value
    ? (JSON.parse(data.value) as Record<string, unknown>)
    : null
}

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

test.describe('Shortcuts: focus-only option and permissions', () => {
  test.describe.configure({ mode: 'serial' })

  test('the focus-only switch is off by default and is saved', async ({
    page,
    request,
  }) => {
    const original = await request.get(SHORTCUTS_SETTING)
    const originalValue = original.ok()
      ? ((await original.json()).data?.value as string | undefined)
      : undefined

    try {
      await page.goto('/settings/shortcuts')
      const toggle = page.getByRole('switch', { name: FOCUS_ONLY_SWITCH })
      await expect(toggle).toBeVisible({ timeout: 10000 })
      await expect(toggle).toHaveAttribute('aria-checked', 'false')

      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-checked', 'true')
      await expect
        .poll(async () => (await savedShortcuts(request))?.onlyWhenAppFocused)
        .toBe(true)

      await page.reload()
      await expect(
        page.getByRole('switch', { name: FOCUS_ONLY_SWITCH }),
      ).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })

      await page.getByRole('switch', { name: FOCUS_ONLY_SWITCH }).click()
      await expect
        .poll(async () => (await savedShortcuts(request))?.onlyWhenAppFocused)
        .toBe(false)
    } finally {
      if (originalValue !== undefined) {
        await request.post('/api/settings/app_settings', {
          data: { key: 'global_keyboard_shortcuts', value: originalValue },
        })
      }
    }
  })

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
