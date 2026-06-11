import { expect, test } from '@playwright/test'

/**
 * Alphabet Fast Scroll — the A–Z rail that appears when the song list is sorted
 * alphabetically (Title A–Z). It groups songs into sticky letter sections and
 * lets the operator jump to any letter, snapping to the nearest populated
 * section when a letter is empty.
 */
test.describe('Songs Alphabet Fast Scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    // The rail only engages in A–Z sort mode; force it and clear any stale
    // "last visited" so the list — not a song-detail page — is what renders.
    await page.evaluate(() => {
      localStorage.setItem('songList.sortBy', 'title')
      localStorage.removeItem('church-hub-last-visited')
    })

    await page.goto('/songs')
    await page.waitForLoadState('networkidle')
  })

  test('shows the alphabet index when sorted A–Z', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/caută|search/i).first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    const hasSongs = await page
      .locator('[data-testid="song-card"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    if (!hasSongs) {
      test.skip(true, 'No songs available to test')
      return
    }

    await expect(page.locator('[data-testid="alphabet-index"]')).toBeVisible()
  })

  test('jumping to a letter scrolls to its section', async ({ page }) => {
    const rail = page.locator('[data-testid="alphabet-index"]')
    if (!(await rail.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Alphabet index not available (no songs)')
      return
    }

    // Pick the first letter that actually has songs (enabled in the rail).
    const enabledLetter = rail.locator('button:not([disabled])').first()
    await expect(enabledLetter).toBeVisible()
    const letter = (await enabledLetter.textContent())?.trim() ?? ''
    expect(letter).not.toBe('')

    await enabledLetter.click()

    // The matching sticky section header should be rendered and in view.
    const header = page.locator(`[data-testid="song-section-${letter}"]`)
    await expect(header).toBeVisible({ timeout: 5000 })
  })
})
