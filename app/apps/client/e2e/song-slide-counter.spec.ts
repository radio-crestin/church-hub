import { type Page, expect, test } from '@playwright/test'

/**
 * Slide counter in the song slides panel toolbar: after opening a song, the
 * top-right of the slide-selection panel shows "<current> / <total>", where
 * current tracks the highlighted slide (live > staged > keyboard selection)
 * and total is the expanded slide count (choruses included).
 *
 * The counter belongs to view mode only — edit mode reuses that corner for
 * the Discard/Save buttons.
 */

/**
 * Opens a song detail page. `/songs` may land on a song directly (the route
 * restores the last opened one), otherwise the first list entry is clicked.
 * Returns false when the instance has no songs to work with.
 */
async function openSong(page: Page): Promise<boolean> {
  await page.goto('/songs')
  await page.waitForLoadState('networkidle')

  if (!/\/songs\/\d+/.test(page.url())) {
    const firstSong = page.locator('button:has(h3)').first()
    if (!(await firstSong.isVisible({ timeout: 5000 }).catch(() => false))) {
      return false
    }
    await firstSong.click()
  }

  await expect(page).toHaveURL(/\/songs\/\d+/, { timeout: 5000 })
  await page.waitForTimeout(800)
  return await page
    .locator('[data-testid="song-slide-0"]')
    .isVisible({ timeout: 3000 })
    .catch(() => false)
}

test.describe('Song Slide Counter', () => {
  test('shows current/total and follows the selected slide', async ({
    page,
  }) => {
    if (!(await openSong(page))) {
      test.skip(true, 'No song with slides available to test')
      return
    }

    const counter = page.locator('[data-testid="song-slide-counter"]')
    await expect(counter).toBeVisible({ timeout: 3000 })

    // Format is "<current> / <total>".
    await expect(counter).toHaveText(/^\d+ \/ \d+$/)

    // The total matches the number of rendered slide rows.
    const slideRows = page.locator('button[data-testid^="song-slide-"]')
    const total = await slideRows.count()
    expect(total).toBeGreaterThan(0)
    await expect(counter).toHaveText(new RegExp(`^\\d+ / ${total}$`))

    // A screen reader gets the unambiguous form, not just "1 / 4".
    await expect(counter).toHaveAttribute('aria-label', /\d+.*\d+/)

    // Selecting another slide moves the counter with it.
    if (total >= 2) {
      await slideRows.nth(1).click()
      await page.waitForTimeout(1000)
      await expect(counter).toHaveText(`2 / ${total}`)
    }
  })

  test('hides the counter in edit mode', async ({ page }) => {
    if (!(await openSong(page))) {
      test.skip(true, 'No song with slides available to test')
      return
    }

    const counter = page.locator('[data-testid="song-slide-counter"]')
    await expect(counter).toBeVisible({ timeout: 3000 })

    const editToggle = page.locator('[data-testid="toggle-slides-edit-mode"]')
    if (!(await editToggle.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'No edit permission for this user')
      return
    }

    await editToggle.click()
    await page.waitForTimeout(500)
    await expect(counter).toBeHidden()

    // Leaving edit mode brings it back.
    await editToggle.click()
    await page.waitForTimeout(500)
    await expect(counter).toBeVisible()
  })
})
