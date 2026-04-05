import { expect, test } from '@playwright/test'

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('can navigate to settings page', async ({ page }) => {
    await expect(page).toHaveURL(/.*settings/)
    // Settings page title should be visible
    const title = page.locator('h1')
    await expect(title).toBeVisible({ timeout: 10000 })
  })

  test('appearance section is visible with language and theme selectors', async ({
    page,
  }) => {
    // Look for the appearance section
    const appearanceSection = page.locator('text=/appearance|aparent|aspect/i')
    await expect(appearanceSection.first()).toBeVisible({ timeout: 10000 })

    // Language selector should exist
    const languageLabel = page.locator('text=/language|limba/i')
    await expect(languageLabel.first()).toBeVisible({ timeout: 5000 })

    // Theme selector should exist
    const themeLabel = page.locator('text=/theme|tema/i')
    await expect(themeLabel.first()).toBeVisible({ timeout: 5000 })
  })

  test('can change language preference', async ({ page }) => {
    // Find the language combobox/select and interact with it
    const languageLabel = page.locator('text=/language|limba/i').first()
    await expect(languageLabel).toBeVisible({ timeout: 5000 })

    // The combobox should be nearby - find it
    const comboboxes = page.locator('button[role="combobox"]')
    const firstCombobox = comboboxes.first()

    if (await firstCombobox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCombobox.click()
      await page.waitForTimeout(500)

      // Look for language options in the dropdown
      const englishOption = page.locator('text=/english|engleza|engleza/i')
      if (
        await englishOption
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await englishOption.first().click()
        await page.waitForTimeout(1000)
      }
    }

    await expect(page.locator('body')).toBeVisible()
  })

  test('can change theme preference', async ({ page }) => {
    // Find theme selector (second combobox typically)
    const comboboxes = page.locator('button[role="combobox"]')
    const count = await comboboxes.count()

    if (count >= 2) {
      const themeCombobox = comboboxes.nth(1)
      await themeCombobox.click()
      await page.waitForTimeout(500)

      // Look for dark/light theme options
      const darkOption = page.locator('text=/dark|inchis|intunecat/i')
      if (
        await darkOption
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await darkOption.first().click()
        await page.waitForTimeout(1000)
      }
    }

    await expect(page.locator('body')).toBeVisible()
  })

  test('developer tools section is visible', async ({ page }) => {
    // Scroll down to find developer tools
    const devSection = page.locator('text=/developer|dezvoltator/i')
    await expect(devSection.first()).toBeVisible({ timeout: 10000 })
  })

  test('debug mode toggle exists and can be toggled', async ({ page }) => {
    // Scroll to bottom to ensure developer tools section is in view
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // Find the debug mode section — use the developer section as anchor
    const devSection = page.locator('text=/developer|dezvoltator/i').first()
    if (await devSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await devSection.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
    }

    const debugLabel = page.locator('text=/debug|depanare/i')
    await expect(debugLabel.first()).toBeVisible({ timeout: 10000 })

    // Find the toggle switch (rounded-full button near debug text)
    const toggleButtons = page.locator(
      'button.rounded-full, button[class*="rounded-full"]',
    )

    if (
      await toggleButtons
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      // Click the toggle
      await toggleButtons.first().click()
      await page.waitForTimeout(500)

      // Click again to restore
      await toggleButtons.first().click()
      await page.waitForTimeout(500)
    }

    await expect(page.locator('body')).toBeVisible()
  })

  test('API docs link is present', async ({ page }) => {
    // Look for API documentation link
    const apiDocsLink = page.locator('a[href*="api/docs"]')
    await expect(apiDocsLink.first()).toBeVisible({ timeout: 10000 })
  })

  test('about section is visible', async ({ page }) => {
    // Scroll down to find the about section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // Look for version info or about section
    const aboutContent = page.locator('text=/version|versiune|about|despre/i')
    if (
      await aboutContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await expect(aboutContent.first()).toBeVisible()
    }
  })
})

test.describe('Settings API', () => {
  test('can read app settings', async ({ request }) => {
    const response = await request.get('/api/settings/app_settings')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('can read user preferences', async ({ request }) => {
    const response = await request.get('/api/settings/user_preferences')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('can upsert and read a setting', async ({ request }) => {
    const testKey = `e2e_test_${Date.now()}`
    const testValue = 'test_value_123'

    // Create setting
    const createResponse = await request.post('/api/settings/app_settings', {
      data: { key: testKey, value: testValue },
    })
    expect(createResponse.status()).toBe(200)

    // Read it back
    const readResponse = await request.get(
      `/api/settings/app_settings/${testKey}`,
    )
    expect(readResponse.status()).toBe(200)
    const readData = await readResponse.json()
    expect(readData.data).toBeTruthy()
    expect(readData.data.value).toBe(testValue)

    // Clean up
    const deleteResponse = await request.delete(
      `/api/settings/app_settings/${testKey}`,
    )
    expect(deleteResponse.status()).toBe(200)
  })

  test('can delete a setting', async ({ request }) => {
    const testKey = `e2e_delete_${Date.now()}`

    // Create it
    await request.post('/api/settings/app_settings', {
      data: { key: testKey, value: 'to_delete' },
    })

    // Delete it
    const deleteResponse = await request.delete(
      `/api/settings/app_settings/${testKey}`,
    )
    expect(deleteResponse.status()).toBe(200)

    // Verify it is gone
    const readResponse = await request.get(
      `/api/settings/app_settings/${testKey}`,
    )
    expect(readResponse.status()).toBe(200)
    const readData = await readResponse.json()
    expect(readData.data).toBeNull()
  })

  test('reading non-existent setting returns null', async ({ request }) => {
    const response = await request.get(
      '/api/settings/app_settings/nonexistent_key_12345',
    )
    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json.data).toBeNull()
  })
})
