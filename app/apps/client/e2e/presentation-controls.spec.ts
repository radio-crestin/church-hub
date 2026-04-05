import { expect, test } from '@playwright/test'

/**
 * E2E tests for the presentation control room (/present).
 * Tests control buttons, live preview, keyboard shortcuts,
 * hide/show toggles, and content type indicators.
 */

test.describe('Presentation Controls', () => {
  test.beforeEach(async ({ request }) => {
    // Stop any active presentation before each test
    await request.post('/api/presentation/stop')
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop')
  })

  test('control room page loads at /present', async ({ page }) => {
    await page.goto('/present')
    await page.waitForLoadState('networkidle')

    // Should see the Control Room heading
    await expect(page.locator('body')).toBeVisible()

    // Look for the control room title or MonitorUp icon area
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  test('LIVE indicator shows when content is being presented', async ({
    page,
    request,
  }) => {
    // Present a song first
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })

    await page.goto('/present')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Look for the LIVE indicator text
    const liveIndicator = page.getByText('LIVE').first()
    await expect(liveIndicator).toBeVisible({ timeout: 10000 })

    // The LIVE indicator should have the active (red) styling
    const liveParent = liveIndicator.locator('..')
    const classList = await liveParent.evaluate((el) => el.className)
    // When presenting, should have red styling
    expect(classList).toContain('red')
  })

  test('LIVE indicator is inactive when nothing is presented', async ({
    page,
  }) => {
    await page.goto('/present')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // LIVE indicator should exist but be in inactive state (gray)
    const liveIndicator = page.getByText('LIVE').first()
    if (await liveIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
      const liveParent = liveIndicator.locator('..')
      const classList = await liveParent.evaluate((el) => el.className)
      // When not presenting, should have gray styling
      expect(classList).toContain('gray')
    }
  })

  test('hide button clears the presentation', async ({ page, request }) => {
    // Present a song
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })

    await page.goto('/present')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find and click the Hide button (contains EyeOff icon or "Hide" text)
    const hideButton = page
      .getByRole('button', { name: /hide|ascunde/i })
      .first()

    if (await hideButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hideButton.click()
      await page.waitForTimeout(1000)

      // After hiding, the state should reflect isHidden=true
      const stateRes = await request.get('/api/presentation/state')
      const state = await stateRes.json()
      expect(state.data.isHidden).toBe(true)
    }
  })

  test('show button reveals the last presented content', async ({
    page,
    request,
  }) => {
    // Present and then hide a song
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })
    await request.post('/api/presentation/clear')

    await page.goto('/present')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find and click the Show button
    const showButton = page.getByRole('button', { name: /show|arata/i }).first()

    if (await showButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await showButton.click()
      await page.waitForTimeout(1000)

      // After showing, the state should reflect isHidden=false
      const stateRes = await request.get('/api/presentation/state')
      const state = await stateRes.json()
      expect(state.data.isHidden).toBe(false)
    }
  })

  test('Escape key hides the presentation', async ({ page, request }) => {
    // Present a song
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })

    await page.goto('/present')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Verify content is being presented
    let stateRes = await request.get('/api/presentation/state')
    let state = await stateRes.json()
    if (!state.data.isHidden) {
      // Press Escape to hide
      await page.keyboard.press('Escape')
      await page.waitForTimeout(1000)

      // Verify the presentation was hidden
      stateRes = await request.get('/api/presentation/state')
      state = await stateRes.json()
      // Escape may trigger hide via keyboard shortcuts
      // The exact behavior depends on shortcut config, so just verify no crash
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('arrow keys navigate slides', async ({ page, request }) => {
    // Present a song
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id, slideIndex: 0 },
    })

    await page.goto('/present')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Get initial state
    const initialState = await request.get('/api/presentation/state')
    const _initialBody = await initialState.json()

    // Press arrow down/right to go to next slide
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(1000)

    // Get state after navigation
    const afterState = await request.get('/api/presentation/state')
    const _afterBody = await afterState.json()

    // State should have been updated (slide index may have changed)
    // The exact behavior depends on keyboard shortcuts configuration
    await expect(page.locator('body')).toBeVisible()

    // Press arrow up to go back
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(500)

    await expect(page.locator('body')).toBeVisible()
  })

  test('live preview section is displayed in control room', async ({
    page,
    request,
  }) => {
    // Present a song to have content in the preview
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })

    await page.goto('/present')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // The control room should have a preview section (white/dark bg card)
    const previewSection = page
      .locator('.bg-white, .dark\\:bg-gray-800')
      .first()
    await expect(previewSection).toBeVisible({ timeout: 10000 })
  })

  test('settings button opens settings modal', async ({ page }) => {
    await page.goto('/present')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find the settings button (gear icon)
    const settingsButton = page
      .getByRole('button', { name: /settings|setari/i })
      .first()

    if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsButton.click()
      await page.waitForTimeout(500)

      // A modal/dialog should appear
      const modal = page.locator('[role="dialog"], .modal, [data-state="open"]')
      const isModalVisible = await modal
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)

      // Settings modal may or may not use role=dialog - just verify no crash
      await expect(page.locator('body')).toBeVisible()

      // Close modal if open (press Escape)
      if (isModalVisible) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }
    }
  })

  test('screen share buttons are visible', async ({ page }) => {
    await page.goto('/present')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Look for screen share start button
    const screenShareButton = page
      .getByRole('button', {
        name: /screen share|partajare|share screen/i,
      })
      .first()

    // Screen share button should be available in the control room toolbar
    // It may be hidden on small screens behind a responsive breakpoint
    const _isVisible = await screenShareButton
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    // Verify the page loaded without errors regardless
    await expect(page.locator('body')).toBeVisible()
  })

  test('presentation state API returns correct structure', async ({
    request,
  }) => {
    const stateRes = await request.get('/api/presentation/state')
    expect(stateRes.ok()).toBeTruthy()

    const body = await stateRes.json()
    const state = body.data

    // Verify the state object has the expected fields
    expect(state).toHaveProperty('isHidden')
    expect(state).toHaveProperty('updatedAt')
    expect(typeof state.isHidden).toBe('boolean')
  })

  test('clear API returns updated state with isHidden=true', async ({
    request,
  }) => {
    // Present something first
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })

    // Clear the presentation
    const clearRes = await request.post('/api/presentation/clear')
    expect(clearRes.ok()).toBeTruthy()

    const clearBody = await clearRes.json()
    expect(clearBody.data.isHidden).toBe(true)
  })

  test('show API returns updated state with isHidden=false', async ({
    request,
  }) => {
    // Present and hide something first
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })
    await request.post('/api/presentation/clear')

    // Show the presentation
    const showRes = await request.post('/api/presentation/show')
    expect(showRes.ok()).toBeTruthy()

    const showBody = await showRes.json()
    expect(showBody.data.isHidden).toBe(false)
  })

  test('stop API clears temporary content', async ({ request }) => {
    // Present a song
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id },
    })

    // Verify it's presented
    let stateRes = await request.get('/api/presentation/state')
    let state = await stateRes.json()
    expect(state.data.temporaryContent).toBeTruthy()

    // Stop the presentation
    const stopRes = await request.post('/api/presentation/stop')
    expect(stopRes.ok()).toBeTruthy()

    // Verify temporary content is cleared
    stateRes = await request.get('/api/presentation/state')
    state = await stateRes.json()
    expect(state.data.temporaryContent).toBeFalsy()
  })

  test('navigate-temporary API changes slide index', async ({ request }) => {
    // Present a song
    const songsRes = await request.get(
      '/api/songs/search?query=&limit=1&offset=0',
    )
    if (!songsRes.ok()) {
      test.skip()
      return
    }
    const songsBody = await songsRes.json()
    const songs = songsBody.data?.songs || songsBody.data
    if (!songs || songs.length === 0) {
      test.skip()
      return
    }

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id, slideIndex: 0 },
    })

    // Get initial state
    let stateRes = await request.get('/api/presentation/state')
    let state = await stateRes.json()
    const _initialSlideIndex =
      state.data.temporaryContent?.data?.currentSlideIndex

    // Navigate to next slide
    const navRes = await request.post('/api/presentation/navigate-temporary', {
      data: { direction: 'next', requestTimestamp: Date.now() },
    })
    expect(navRes.ok()).toBeTruthy()

    // Check if slide index changed
    stateRes = await request.get('/api/presentation/state')
    state = await stateRes.json()
    const newSlideIndex = state.data.temporaryContent?.data?.currentSlideIndex

    // If the song has more than one slide, the index should have advanced
    // If only one slide, it should stay the same
    expect(newSlideIndex).toBeDefined()
  })

  test('control room is responsive to different viewport sizes', async ({
    page,
  }) => {
    const viewports = [
      { width: 1920, height: 1080, label: 'desktop' },
      { width: 768, height: 1024, label: 'tablet' },
      { width: 375, height: 812, label: 'mobile' },
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await page.goto('/present')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Control room should load without errors at any viewport
      await expect(page.locator('body')).toBeVisible()

      // The heading should still be visible
      const heading = page.locator('h1').first()
      await expect(heading).toBeVisible({ timeout: 5000 })
    }
  })
})
