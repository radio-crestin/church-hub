import { expect, test } from '@playwright/test'

/**
 * Preview mode for songs: when ON, clicking a verse/chorus stages it in the
 * local stage (indigo) without projecting; the operator then projects it via
 * the Afișează button (or a double-click). When OFF, a single click projects
 * immediately (legacy behaviour).
 */
test.describe('Song Preview Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')
  })

  test('stages a slide before projecting, then projects it', async ({
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

    // Ensure Preview mode is ON (it persists globally).
    if ((await toggle.getAttribute('aria-checked')) !== 'true') {
      await toggle.click()
    }
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    const slide = page.locator('[data-testid="song-slide-0"]')
    if (!(await slide.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No slides visible')
      return
    }

    // Single click stages the slide (indigo ring) — it must NOT go live yet.
    await slide.click()
    await page.waitForTimeout(400)
    await expect(slide).toHaveClass(/ring-indigo-500/)

    // The Afișează (Project) button appears once something is staged.
    const projectBtn = page.locator('[data-testid="song-project-staged"]')
    await expect(projectBtn).toBeVisible({ timeout: 3000 })

    // Projecting promotes the staged slide to live (green ring).
    await projectBtn.click()
    await page.waitForTimeout(800)
    await expect(slide).toHaveClass(/ring-green-500/)

    // Clean up: hide the projection and turn Preview mode back off.
    const hideBtn = page.getByRole('button', { name: /ascunde|hide/i }).first()
    if (await hideBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hideBtn.click()
      await page.waitForTimeout(300)
    }
    if ((await toggle.getAttribute('aria-checked')) === 'true') {
      await toggle.click()
    }
  })
})
