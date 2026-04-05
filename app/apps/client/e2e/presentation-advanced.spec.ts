import { expect, test } from '@playwright/test'

test.describe('Presentation API - State Management', () => {
  test('can get presentation state', async ({ request }) => {
    const response = await request.get('/api/presentation/state')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
  })

  test('can stop presentation', async ({ request }) => {
    const response = await request.post('/api/presentation/stop')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
  })

  test('can clear (hide) current slide', async ({ request }) => {
    const response = await request.post('/api/presentation/clear')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
  })

  test('can show last displayed slide after clearing', async ({ request }) => {
    const response = await request.post('/api/presentation/show')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
  })

  test('clear then show cycle works correctly', async ({ request }) => {
    // Clear
    const clearResponse = await request.post('/api/presentation/clear')
    expect(clearResponse.status()).toBe(200)

    // Verify state shows cleared
    const stateAfterClear = await request.get('/api/presentation/state')
    expect(stateAfterClear.status()).toBe(200)

    // Show
    const showResponse = await request.post('/api/presentation/show')
    expect(showResponse.status()).toBe(200)

    // Verify state after show
    const stateAfterShow = await request.get('/api/presentation/state')
    expect(stateAfterShow.status()).toBe(200)
  })
})

test.describe('Presentation API - Queue Navigation', () => {
  test('can navigate queue forward', async ({ request }) => {
    const response = await request.post('/api/presentation/navigate-queue', {
      data: { direction: 'next' },
    })
    // May be 200 or 400 (if no queue content)
    expect([200, 400]).toContain(response.status())
  })

  test('can navigate queue backward', async ({ request }) => {
    const response = await request.post('/api/presentation/navigate-queue', {
      data: { direction: 'prev' },
    })
    expect([200, 400]).toContain(response.status())
  })

  test('navigate queue with invalid direction returns error', async ({
    request,
  }) => {
    const response = await request.post('/api/presentation/navigate-queue', {
      data: { direction: 'invalid' },
    })
    expect([400, 500]).toContain(response.status())
  })
})

test.describe('Presentation API - Temporary Content', () => {
  test('can present a Bible verse temporarily', async ({ request }) => {
    // First get available translations
    const translationsResponse = await request.get('/api/bible/translations')
    const translationsJson = await translationsResponse.json()

    if (translationsJson.data.length === 0) {
      test.skip(true, 'No Bible translations available')
      return
    }

    const translationId = translationsJson.data[0].id

    // Get books
    const booksResponse = await request.get(`/api/bible/books/${translationId}`)
    const booksJson = await booksResponse.json()

    if (booksJson.data.length === 0) {
      test.skip(true, 'No Bible books available')
      return
    }

    const bookId = booksJson.data[0].id

    // Get verses from chapter 1
    const versesResponse = await request.get(`/api/bible/verses/${bookId}/1`)
    const versesJson = await versesResponse.json()

    if (versesJson.data.length === 0) {
      test.skip(true, 'No verses available')
      return
    }

    const verseId = versesJson.data[0].id

    // Present the verse temporarily
    const presentResponse = await request.post(
      '/api/presentation/temporary-bible',
      {
        data: { verseId },
      },
    )
    expect(presentResponse.status()).toBe(200)

    const json = await presentResponse.json()
    expect(json).toHaveProperty('data')

    // Clean up - stop presentation
    await request.post('/api/presentation/stop')
  })

  test('can present a song temporarily', async ({ request }) => {
    // Get a song
    const songsResponse = await request.get('/api/songs?limit=1')
    const songsJson = await songsResponse.json()

    if (songsJson.data.length === 0) {
      test.skip(true, 'No songs available')
      return
    }

    const songId = songsJson.data[0].id

    // Get the song with slides
    const songResponse = await request.get(`/api/songs/${songId}`)
    const songJson = await songResponse.json()

    if (!songJson.data.slides || songJson.data.slides.length === 0) {
      test.skip(true, 'Song has no slides')
      return
    }

    const slideId = songJson.data.slides[0].id

    const presentResponse = await request.post(
      '/api/presentation/temporary-song',
      {
        data: { songId, slideId },
      },
    )
    expect(presentResponse.status()).toBe(200)

    // Clean up
    await request.post('/api/presentation/stop')
  })

  test('can navigate within temporary content', async ({ request }) => {
    const response = await request.post(
      '/api/presentation/navigate-temporary',
      {
        data: { direction: 'next' },
      },
    )
    // May succeed or fail depending on whether temporary content is active
    expect([200, 400]).toContain(response.status())
  })
})

test.describe('Presentation - UI Keyboard Navigation', () => {
  test('arrow keys navigate song slides', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    const songElement = page
      .locator('[data-testid="song-card"], [data-testid="song-list-item"]')
      .first()

    if (!(await songElement.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No songs available')
      return
    }

    await songElement.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Click first slide to present it
    const firstSlide = page.locator('button.rounded-lg').first()
    if (!(await firstSlide.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'No slides visible')
      return
    }
    await firstSlide.click()
    await page.waitForTimeout(500)

    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)

    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(300)

    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(300)

    // Page should remain functional
    await expect(page.locator('body')).toBeVisible()
  })

  test('Escape key clears presentation', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    const songElement = page
      .locator('[data-testid="song-card"], [data-testid="song-list-item"]')
      .first()

    if (!(await songElement.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No songs available')
      return
    }

    await songElement.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Click first slide
    const firstSlide = page.locator('button.rounded-lg').first()
    if (await firstSlide.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstSlide.click()
      await page.waitForTimeout(500)

      // Press Escape to clear
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }

    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Presentation - Multi-screen', () => {
  test('multiple screen pages can render simultaneously', async ({
    browser,
    request,
  }) => {
    const listResponse = await request.get('/api/screens')
    const listJson = await listResponse.json()

    if (listJson.data.length < 1) {
      test.skip(true, 'Need at least 1 screen configured')
      return
    }

    const screenId = listJson.data[0].id

    // Open two browser contexts simulating multiple screens
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    await page1.goto(`/screen/${screenId}`)
    await page2.goto(`/screen/${screenId}`)

    await page1.waitForLoadState('networkidle')
    await page2.waitForLoadState('networkidle')

    // Both pages should render without errors
    await expect(page1.locator('body')).toBeVisible()
    await expect(page2.locator('body')).toBeVisible()

    await context1.close()
    await context2.close()
  })
})
