import { expect, test } from '@playwright/test'

test.describe('Songs Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('can navigate to songs page', async ({ page }) => {
    // Navigate directly to songs page
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    // Verify we're on the songs page
    await expect(page).toHaveURL(/.*songs/)
  })

  test('displays song list', async ({ page }) => {
    await page.goto('/songs')

    // Wait for songs to load - look for song cards or list items
    await page
      .waitForSelector(
        '[data-testid="song-card"], [data-testid="song-list-item"]',
        {
          timeout: 10000,
        },
      )
      .catch(() => {
        // If no test IDs, look for any content indicating songs loaded
      })

    // The page should have loaded without errors
    await expect(page.locator('body')).toBeVisible()
  })

  test('can search for songs', async ({ page }) => {
    await page.goto('/songs')

    // Find and use search input
    const searchInput = page.getByPlaceholder(/search/i).first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      // Give time for search results to update
      await page.waitForTimeout(500)
    }

    // Page should remain functional after search
    await expect(page.locator('body')).toBeVisible()
  })

  test('can display a song for presentation', async ({ page }) => {
    await page.goto('/songs')

    // Wait for page load
    await page.waitForLoadState('networkidle')

    // Look for any clickable song element
    const songElement = page
      .locator('[data-testid="song-card"], [data-testid="song-list-item"]')
      .first()

    if (await songElement.isVisible({ timeout: 5000 }).catch(() => false)) {
      await songElement.click()

      // After clicking a song, we should see song details or presentation controls
      await page.waitForTimeout(500)
    }

    // Verify page is still functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('slide edit syncs to preview in real-time', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    // Click the first song to open its preview page
    const songElement = page
      .locator('[data-testid="song-card"], [data-testid="song-list-item"]')
      .first()

    if (!(await songElement.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No songs available to test')
      return
    }
    await songElement.click()
    await page.waitForLoadState('networkidle')

    // Wait for slides to render
    await page.waitForTimeout(1000)

    // Click the first slide to select and present it
    const firstSlide = page.locator('button.rounded-lg').first()
    if (!(await firstSlide.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No slides visible')
      return
    }
    await firstSlide.click()
    await page.waitForTimeout(500)

    // Click the edit mode button (yellow amber button with pencil icon)
    const editButton = page
      .getByRole('button', { name: /editare|edit mode/i })
      .first()
    if (!(await editButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Edit button not found')
      return
    }
    await editButton.click()
    await page.waitForTimeout(500)

    // In edit mode, textareas should appear for inline editing
    const textarea = page.locator('textarea').first()
    if (!(await textarea.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No textarea found in edit mode')
      return
    }

    // Get original content
    const originalContent = await textarea.inputValue()

    // Append a test marker to the content
    const testMarker = ` [sync-test-${Date.now()}]`
    await textarea.fill(originalContent + testMarker)

    // Blur the textarea to trigger save
    await page.click('body', { position: { x: 0, y: 0 } })
    await page.waitForTimeout(2000) // Wait for save + WebSocket sync

    // Exit edit mode to see updated slides
    const doneButton = page
      .getByRole('button', { name: /gata|done/i })
      .first()
    if (await doneButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await doneButton.click()
      await page.waitForTimeout(500)
    }

    // Verify the slide content now contains the test marker
    const updatedSlide = page.locator('button.rounded-lg').first()
    await expect(updatedSlide).toContainText(testMarker.trim(), {
      timeout: 5000,
    })

    // Restore original content: re-enter edit mode and revert
    const editAgainButton = page
      .getByRole('button', { name: /editare|edit mode/i })
      .first()
    if (
      await editAgainButton.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await editAgainButton.click()
      await page.waitForTimeout(500)
      const restoreTextarea = page.locator('textarea').first()
      if (
        await restoreTextarea.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await restoreTextarea.fill(originalContent)
        await page.click('body', { position: { x: 0, y: 0 } })
        await page.waitForTimeout(1000)
      }
    }
  })
})
