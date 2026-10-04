import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The Bible's sidebar shortcut (F6 by default) jumps to the search box with
 * its text selected, so the next reference can be typed straight away.
 *
 * Two ways it failed: the key reaching the page did nothing (only the desktop
 * shell's OS-wide registration handled it; a browser then moved focus to its
 * address bar), and with the box already focused — right after a search +
 * Enter — the old text stayed unselected, so "Gen 1:1" was glued onto
 * "Ioan 3:16".
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

const searchBox = (page: Page) =>
  page.getByPlaceholder(/search|cauta|căuta/i).first()

async function searchAndShow(page: Page, reference: string) {
  const search = searchBox(page)
  await search.fill(reference)
  await page.waitForTimeout(800)
  await search.press('Enter')
  await expect(page.locator('button.ring-green-500')).toBeVisible({
    timeout: 10000,
  })
}

async function expectSearchFocusedAndSelected(page: Page, value: string) {
  await expect(searchBox(page)).toBeFocused()
  await expect
    .poll(() =>
      searchBox(page).evaluate((input: HTMLInputElement) => [
        input.selectionStart,
        input.selectionEnd,
      ]),
    )
    .toEqual([0, value.length])
}

test.describe('Bible search shortcut', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/presentation/clear-temporary').catch(() => {})
  })

  test('selects the previous reference when the search box already has focus', async ({
    page,
    request,
  }) => {
    const shortcut = await bibleShortcut(request)
    await page.goto('/bible')
    await searchAndShow(page, 'Ioan 3:16')
    await expect(searchBox(page)).toBeFocused()

    await page.keyboard.press(shortcut)
    await expectSearchFocusedAndSelected(page, 'Ioan 3:16')

    await page.keyboard.type('Gen 1:1')
    await expect(searchBox(page)).toHaveValue('Gen 1:1')
  })

  test('moves the focus back to the search box from the verse list', async ({
    page,
    request,
  }) => {
    const shortcut = await bibleShortcut(request)
    await page.goto('/bible')
    await searchAndShow(page, 'Ioan 3:16')

    await page
      .getByTestId('bible-verses-scroll')
      .locator('[data-verse="17"]')
      .last()
      .click()
    await expect(searchBox(page)).not.toBeFocused()

    await page.keyboard.press(shortcut)
    await expectSearchFocusedAndSelected(page, 'Ioan 3:16')
  })

  test('opens the Bible with its search focused from another page', async ({
    page,
    request,
  }) => {
    const shortcut = await bibleShortcut(request)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.keyboard.press(shortcut)
    await expect(page).toHaveURL(/\/bible/)
    await expect(searchBox(page)).toBeFocused()
  })
})
