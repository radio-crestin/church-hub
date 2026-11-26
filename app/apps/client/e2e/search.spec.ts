import { expect, test } from '@playwright/test'

test.describe('Search clear (X) button', () => {
  /**
   * Every search input gets an X once it has content; pressing it must
   * clear the input AND return keyboard focus to it.
   */
  const clearButtonFor = (searchInput: import('@playwright/test').Locator) =>
    searchInput.locator(
      'xpath=following-sibling::*[@data-testid="clear-search-button"]',
    )

  test('Bible search X clears the input and refocuses it', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search|caută/i).first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    await searchInput.fill('Dumnezeu')
    const clearButton = clearButtonFor(searchInput)
    await expect(clearButton).toBeVisible()

    await clearButton.click()
    await expect(searchInput).toHaveValue('')
    await expect(searchInput).toBeFocused()
    await expect(clearButton).toBeHidden()
  })

  test('Songs search X clears the input and refocuses it', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    const searchInput = page
      .getByPlaceholder(/search songs|caută cântări/i)
      .first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    await searchInput.fill('test')
    const clearButton = clearButtonFor(searchInput)
    await expect(clearButton).toBeVisible()

    await clearButton.click()
    await expect(searchInput).toHaveValue('')
    await expect(searchInput).toBeFocused()
    await expect(clearButton).toBeHidden()
  })

  test('Schedules search X clears the input and refocuses it', async ({
    page,
  }) => {
    await page.goto('/schedules')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search|caută/i).first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    await searchInput.fill('test')
    const clearButton = clearButtonFor(searchInput)
    await expect(clearButton).toBeVisible()

    await clearButton.click()
    await expect(searchInput).toHaveValue('')
    await expect(searchInput).toBeFocused()
    await expect(clearButton).toBeHidden()
  })
})
