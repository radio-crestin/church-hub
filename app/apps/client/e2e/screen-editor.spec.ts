import { expect, test } from '@playwright/test'

test.describe('Screen Renderer Page', () => {
  test('invalid screen ID shows error message', async ({ page }) => {
    await page.goto('/screen/invalid')
    await page.waitForLoadState('networkidle')

    // Should show invalid screen ID message
    const errorText = page.locator('text=/invalid screen/i')
    await expect(errorText).toBeVisible({ timeout: 5000 })
  })

  test('screen page with negative ID shows error', async ({ page }) => {
    await page.goto('/screen/-1')
    await page.waitForLoadState('networkidle')

    const errorText = page.locator('text=/invalid screen/i')
    await expect(errorText).toBeVisible({ timeout: 5000 })
  })
})
