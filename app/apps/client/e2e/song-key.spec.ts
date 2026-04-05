import { expect, test } from '@playwright/test'

test.describe('Song Key Tracking Page', () => {
  test('can navigate to song key page', async ({ page }) => {
    await page.goto('/song-key')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/.*song-key/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('song key page renders content', async ({ page }) => {
    await page.goto('/song-key')
    await page.waitForLoadState('networkidle')

    // The page should have some meaningful content
    await page.waitForTimeout(2000)
    const bodyHtml = await page.locator('body').innerHTML()
    expect(bodyHtml.length).toBeGreaterThan(100)
  })

  test('song key page has interactive elements', async ({ page }) => {
    await page.goto('/song-key')
    await page.waitForLoadState('networkidle')

    // Look for buttons or interactive controls
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()

    // The page should have at least some buttons
    expect(buttonCount).toBeGreaterThan(0)
  })
})
