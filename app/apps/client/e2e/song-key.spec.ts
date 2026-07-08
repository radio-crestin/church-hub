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

test.describe('Setting a song key from the key button', () => {
  test('updates the key shown in the Marcaje panel for a bookmarked song', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const title = `E2E KeySync ${uniq}`
    const oldKey = `Zkey-${uniq}-A`
    const newKey = `Zkey-${uniq}-B`

    const createRes = await request.post('/api/songs', {
      data: { title, keyLine: oldKey, slides: [{ content: 'Line', sortOrder: 0 }] },
    })
    expect(createRes.status()).toBe(201)
    const { data: song } = await createRes.json()

    // Bookmark the song so it appears in the Marcaje panel.
    const bmRes = await request.post('/api/song-bookmarks', {
      data: { songId: song.id },
    })
    expect(bmRes.ok()).toBeTruthy()

    try {
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')

      // The bookmark row for this song shows the current key.
      const row = page
        .getByTestId('bookmark-item')
        .filter({ hasText: title })
      await expect(row.getByTestId('bookmark-key-line')).toHaveText(oldKey, {
        timeout: 10000,
      })

      // Change the key via the dedicated key button (not the edit form).
      await page.getByTestId('song-key-button').click()
      const input = page.locator('#keyLine')
      await expect(input).toBeVisible({ timeout: 10000 })
      await input.fill(newKey)
      await page.getByTestId('key-line-save').click()

      // The Marcaje panel must reflect the new key (regression: it kept the old).
      await expect(row.getByTestId('bookmark-key-line')).toHaveText(newKey, {
        timeout: 10000,
      })
    } finally {
      await request.delete(`/api/song-bookmarks/${song.id}`).catch(() => {})
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
