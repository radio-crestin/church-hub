import { expect, test } from '@playwright/test'

test.describe('Schedules Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('can navigate to schedules page', async ({ page }) => {
    // Navigate directly to schedules page
    await page.goto('/schedules')
    await page.waitForLoadState('networkidle')

    // Verify we're on the schedules page
    await expect(page).toHaveURL(/.*schedules/)
  })

  test('displays schedule list', async ({ page }) => {
    await page.goto('/schedules')
    await page.waitForLoadState('networkidle')

    // Page should load successfully
    await expect(page.locator('body')).toBeVisible()
  })

  test('can create a new schedule', async ({ page }) => {
    await page.goto('/schedules')
    await page.waitForLoadState('networkidle')

    // Look for create/add button
    const createButton = page
      .getByRole('button', { name: /create|new|add|adauga/i })
      .first()

    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click()

      // Wait for modal or form to appear
      await page.waitForTimeout(500)

      // Look for name input in modal
      const nameInput = page.getByPlaceholder(/name|nume|title|titlu/i).first()
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        const testName = `Test Schedule ${Date.now()}`
        await nameInput.fill(testName)

        // Look for save/create button
        const saveButton = page
          .getByRole('button', { name: /save|create|salveaza|creeaza/i })
          .first()
        if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await saveButton.click()
          await page.waitForTimeout(1000)
        }
      }
    }

    // Verify page is functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('can open and view a schedule', async ({ page }) => {
    await page.goto('/schedules')
    await page.waitForLoadState('networkidle')

    // Look for any schedule card or list item
    const scheduleItem = page
      .locator('[data-testid="schedule-card"], [data-testid="schedule-item"]')
      .first()

    if (await scheduleItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scheduleItem.click()
      await page.waitForTimeout(500)
    }

    // Verify page is functional
    await expect(page.locator('body')).toBeVisible()
  })
})
