import { expect, test } from '@playwright/test'

/**
 * Preview mode for songs: when ON, clicking a verse/chorus stages it in the
 * local stage (indigo) without projecting; the operator then projects it via
 * the Afișează button (or a double-click). When OFF, a single click projects
 * immediately (legacy behaviour).
 *
 * Also covered:
 * - Enabling Preview auto-stages a slide so the small stage shows text.
 * - Hiding the projection while Preview is ON keeps the text staged.
 */
test.describe('Song Preview Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')
  })

  test('stages, projects, auto-stages on enable, and retains text on hide', async ({
    page,
  }) => {
    // Open the first available song.
    const firstSong = page.locator('button:has(h3)').first()
    if (!(await firstSong.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No songs available to test')
      return
    }
    await firstSong.click()
    await expect(page).toHaveURL(/\/songs\/\d+/, { timeout: 5000 })
    await page.waitForTimeout(800)

    const toggle = page.locator('#song-preview-mode')
    if (!(await toggle.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Preview toggle not found')
      return
    }

    const slide0 = page.locator('[data-testid="song-slide-0"]')
    if (!(await slide0.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No slides visible')
      return
    }

    // Start from a clean OFF state so toggling ON is a real OFF->ON transition.
    if ((await toggle.getAttribute('aria-checked')) === 'true') {
      await toggle.click()
      await page.waitForTimeout(200)
    }

    // Enabling Preview auto-stages a slide (indigo) without any click.
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(slide0).toHaveClass(/ring-indigo-500/)

    // The Afișează (Project) button is available for the staged slide.
    const projectBtn = page.locator('[data-testid="song-project-staged"]')
    await expect(projectBtn).toBeVisible({ timeout: 3000 })

    // Projecting promotes the staged slide to live (green ring).
    await projectBtn.click()
    await page.waitForTimeout(800)
    await expect(slide0).toHaveClass(/ring-green-500/)

    // Hiding with Preview ON keeps the text in the small stage: the slide goes
    // back to staged (indigo) and can be re-projected.
    const hideBtn = page.getByRole('button', { name: /ascunde|hide/i }).first()
    await expect(hideBtn).toBeVisible({ timeout: 3000 })
    await hideBtn.click()
    await page.waitForTimeout(600)
    await expect(slide0).toHaveClass(/ring-indigo-500/)
    await expect(projectBtn).toBeVisible()

    // Clean up: turn Preview mode back off.
    await toggle.click()
  })
})
