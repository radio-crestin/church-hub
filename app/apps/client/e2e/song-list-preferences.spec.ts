import { expect, type Page, test } from '@playwright/test'

/**
 * The view options on the song list — sort and filters — belong to the
 * operator: whatever they leave set must still be set the next time the app
 * opens. Searching used to overwrite the stored values, so one keystroke threw
 * the settings away for good.
 */

const STORAGE_KEYS = {
  sortBy: 'songList.sortBy',
  hasKeyLine: 'songList.hasKeyLine',
} as const

/** Opens the list with the given preferences already stored, as a restart would. */
async function openSongList(page: Page, stored: Record<string, string>) {
  await page.goto('/songs')
  await page.waitForLoadState('networkidle')
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value)
    }
    // Otherwise the page forwards to the song that was open last.
    localStorage.removeItem('church-hub-last-visited')
  }, stored)
  await page.goto('/songs')
  await page.waitForLoadState('networkidle')
}

function readStored(page: Page, key: string) {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

test.describe('Song list view options', () => {
  test('survive searching and reopening the app', async ({ page }) => {
    await openSongList(page, {
      [STORAGE_KEYS.sortBy]: 'title',
      [STORAGE_KEYS.hasKeyLine]: 'true',
    })

    const searchInput = page.getByPlaceholder(/caută|search/i).first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    await searchInput.fill('a')
    await expect(searchInput).toHaveValue('a')
    // Long enough for the debounce and the effects that run on a new query.
    await page.waitForTimeout(1000)

    expect(await readStored(page, STORAGE_KEYS.sortBy)).toBe('title')
    expect(await readStored(page, STORAGE_KEYS.hasKeyLine)).toBe('true')

    // Reopening the app: same storage, fresh page.
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')
    expect(await readStored(page, STORAGE_KEYS.sortBy)).toBe('title')
    expect(await readStored(page, STORAGE_KEYS.hasKeyLine)).toBe('true')
  })

  test('the A–Z rail comes back once the search is cleared', async ({
    page,
  }) => {
    await openSongList(page, { [STORAGE_KEYS.sortBy]: 'title' })

    const rail = page.locator('[data-testid="alphabet-index"]')
    const hasSongs = await page
      .locator('[data-testid="song-card"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    if (!hasSongs) {
      test.skip(true, 'No songs available to test')
      return
    }
    await expect(rail).toBeVisible()

    const searchInput = page.getByPlaceholder(/caută|search/i).first()
    await searchInput.fill('a')
    await page.waitForTimeout(1000)
    await searchInput.fill('')

    // The rail only shows in A–Z mode, so it returning proves the sort itself
    // came through the search unharmed.
    await expect(rail).toBeVisible({ timeout: 10000 })
  })
})
