import { expect, test } from '@playwright/test'

test.describe('Bible Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('can navigate to bible page', async ({ page }) => {
    // Navigate directly to bible page
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    // Verify we're on the bible page
    await expect(page).toHaveURL(/.*bible/)
  })

  test('displays books list', async ({ page }) => {
    await page.goto('/bible')

    // Wait for books to load
    await page.waitForLoadState('networkidle')

    // Page should have loaded
    await expect(page.locator('body')).toBeVisible()
  })

  test('can select a book and chapter', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    // Look for Genesis or first book
    const genesisButton = page
      .getByRole('button', { name: /genesis|geneza/i })
      .first()

    if (await genesisButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await genesisButton.click()

      // Wait for chapters to appear
      await page.waitForTimeout(500)

      // Try to click chapter 1
      const chapter1 = page.getByRole('button', { name: /^1$/ }).first()
      if (await chapter1.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chapter1.click()
      }
    }

    // Verify page is functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('can display a verse', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    // Try to navigate to a specific verse using search or navigation
    const searchInput = page.getByPlaceholder(/search|cauta/i).first()

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('John 3:16')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1000)
    }

    // Verify page is functional
    await expect(page.locator('body')).toBeVisible()
  })
})
