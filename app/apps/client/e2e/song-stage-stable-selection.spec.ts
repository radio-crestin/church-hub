import { expect, type Locator, test } from '@playwright/test'

/**
 * Clicking the slide on the stage opens the in-place editor and its formatting
 * bar. The bar floats over the stage as an overlay, so the click never moves
 * or resizes the slide, the thumbnails or the buttons around it (T-201). It
 * used to be inserted above the stage and pushed everything down.
 */
test.describe('Stage editor selection keeps the layout still', () => {
  test('selecting the slide leaves its box and its neighbours where they were', async ({
    page,
    request,
  }) => {
    const createResponse = await request.post('/api/songs', {
      data: {
        title: `E2E Stable selection ${Date.now()}`,
        slides: [
          { content: '<p>First verse line</p>', sortOrder: 0 },
          { content: '<p>Second verse line</p>', sortOrder: 1 },
        ],
      },
    })
    expect(createResponse.status()).toBe(201)
    const { data: song } = await createResponse.json()

    try {
      await page.setViewportSize({ width: 1600, height: 900 })
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${song.id}`)

      const canvas = page.getByTestId('slide-canvas-box')
      await expect(canvas).toContainText('First verse line')
      const neighbours: Record<string, Locator> = {
        canvas,
        firstThumbnail: page.getByTestId('stage-thumbnail').first(),
        secondThumbnail: page.getByTestId('stage-thumbnail').nth(1),
        next: page.getByTestId('stage-next'),
        present: page.getByTestId('stage-present'),
      }
      const before: Record<string, unknown> = {}
      for (const [name, locator] of Object.entries(neighbours)) {
        before[name] = await locator.boundingBox()
      }

      await page.locator('[data-editing]').click()
      await expect(page.getByTestId('slide-canvas-editable')).toBeVisible()
      await expect(page.getByTestId('slide-style-toolbar')).toBeVisible()

      for (const [name, locator] of Object.entries(neighbours)) {
        expect(await locator.boundingBox(), name).toEqual(before[name])
      }
      // The bar sits over the page, not in its flow.
      await expect(page.getByTestId('slide-style-toolbar-overlay')).toHaveCSS(
        'position',
        'absolute',
      )
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
