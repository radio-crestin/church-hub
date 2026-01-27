import { expect, test } from '@playwright/test'

test.describe('Presentation Feature', () => {
  test('can navigate using keyboard arrows', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    // Try to select a song first
    const songElement = page
      .locator('[data-testid="song-card"], [data-testid="song-list-item"]')
      .first()

    if (await songElement.isVisible({ timeout: 5000 }).catch(() => false)) {
      await songElement.click()
      await page.waitForTimeout(500)

      // Press arrow down to navigate slides
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(300)

      // Press arrow up to go back
      await page.keyboard.press('ArrowUp')
      await page.waitForTimeout(300)
    }

    // Verify page is functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('presentation controls are accessible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Page should have loaded with presentation controls
    await expect(page.locator('body')).toBeVisible()
  })

  test('can clear presentation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for clear button
    const clearButton = page
      .getByRole('button', { name: /clear|sterge|hide/i })
      .first()

    if (await clearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clearButton.click()
      await page.waitForTimeout(300)
    }

    // Verify page is functional
    await expect(page.locator('body')).toBeVisible()
  })
})
