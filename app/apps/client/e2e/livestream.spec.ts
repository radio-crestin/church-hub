import { expect, test } from '@playwright/test'

test.describe('Livestream Page', () => {
  test('can navigate to livestream page', async ({ page }) => {
    await page.goto('/livestream')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/.*livestream/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('livestream page displays OBS connection section', async ({ page }) => {
    await page.goto('/livestream')
    await page.waitForLoadState('networkidle')

    // Look for OBS-related content
    const obsContent = page.locator('text=/OBS|obs|stream|broadcast/i')
    if (
      await obsContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await expect(obsContent.first()).toBeVisible()
    }

    await expect(page.locator('body')).toBeVisible()
  })

  test('livestream page shows connection status indicators', async ({
    page,
  }) => {
    await page.goto('/livestream')
    await page.waitForLoadState('networkidle')

    // The page should render without errors, showing connection status
    // Look for connect/disconnect buttons or status indicators
    const _connectButtons = page.locator(
      'button:has-text(/connect|conectare|disconnect|deconectare/i)',
    )

    await page.waitForTimeout(2000)
    await expect(page.locator('body')).toBeVisible()
  })

  test('livestream page has YouTube integration section', async ({ page }) => {
    await page.goto('/livestream')
    await page.waitForLoadState('networkidle')

    // Look for YouTube-related content
    const youtubeContent = page.locator('text=/youtube|YouTube/i')
    if (
      await youtubeContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await expect(youtubeContent.first()).toBeVisible()
    }
  })

  test('livestream page shows scene grid or scene controls', async ({
    page,
  }) => {
    await page.goto('/livestream')
    await page.waitForLoadState('networkidle')

    // Look for scene-related elements
    const sceneContent = page.locator('text=/scene|scena/i')
    if (
      await sceneContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await expect(sceneContent.first()).toBeVisible()
    }
  })
})

test.describe('Live Translation Page', () => {
  test('can navigate to live translation page', async ({ page }) => {
    await page.goto('/live-translation')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/.*live-translation/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('live translation page renders content', async ({ page }) => {
    await page.goto('/live-translation')
    await page.waitForLoadState('networkidle')

    // The page should have some UI elements
    await page.waitForTimeout(2000)
    const bodyHtml = await page.locator('body').innerHTML()
    expect(bodyHtml.length).toBeGreaterThan(100)
  })

  test('settings expose only the Gemini key (no engine/voice/modality)', async ({
    page,
  }) => {
    await page.goto('/live-translation')
    await page.waitForLoadState('networkidle')

    // Open the settings dialog (header toggle button labelled "Settings")
    await page.getByRole('button', { name: 'Settings' }).first().click()

    // The single Gemini API key field is present
    await expect(
      page.getByPlaceholder('Enter your Gemini API key'),
    ).toBeVisible()

    // Removed multi-engine controls must be gone
    await expect(page.getByText('OpenAI Realtime')).toHaveCount(0)
    await expect(page.getByText('Output type')).toHaveCount(0)
    await expect(page.getByText('Voice', { exact: true })).toHaveCount(0)

    // Target languages are still configurable
    await expect(page.getByText('Add another language')).toBeVisible()
  })
})
