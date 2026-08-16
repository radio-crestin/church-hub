import { expect, test } from '@playwright/test'

/**
 * Per-slide text styling in the PowerPoint layout: the formatting bar above the
 * stage overrides the screen's default text style for one slide only, the
 * override is persisted with the slide, and the restore button drops it so the
 * slide follows the screen settings again.
 *
 * The same layout also shows a slide counter beside the stage clock.
 */
test.describe('Per-slide text styling', () => {
  test('applies, persists and restores a slide style override', async ({
    page,
    request,
  }) => {
    const title = `E2E Slide Style ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          { content: 'First slide', sortOrder: 0 },
          { content: 'Second slide', sortOrder: 1 },
        ],
      },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    const readOverride = async () => {
      const res = await request.get(`/api/songs/${created.id}`)
      const { data } = await res.json()
      return data.slides[0].styleOverrides
    }

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${created.id}`)
      await page.waitForLoadState('networkidle')

      const toolbar = page.getByTestId('slide-style-toolbar')
      await expect(toolbar).toBeVisible({ timeout: 10000 })

      // A brand new slide follows the screen settings — no override stored.
      expect(await readOverride()).toBeNull()

      // Enlarge the slide's text and make it bold, then align it to the start.
      await page.getByTestId('slide-style-font-increase').click()
      await page.getByTestId('slide-style-bold').click()
      await page.getByTestId('slide-style-align-left').click()

      // The autosave that persists slide edits persists the styling too.
      await expect
        .poll(readOverride, { timeout: 10000 })
        .toMatchObject({ bold: true, alignment: 'left' })

      const stored = await readOverride()
      expect(stored.fontScale).toBeGreaterThan(1)

      // The override survives a reload and the toolbar reflects it.
      await page.reload()
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('slide-style-bold')).toHaveAttribute(
        'aria-pressed',
        'true',
        { timeout: 10000 },
      )

      // Restore default drops the override entirely.
      await page.getByTestId('slide-style-reset').click()
      await expect.poll(readOverride, { timeout: 10000 }).toBeNull()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('styles only the selected slide', async ({ page, request }) => {
    const title = `E2E Slide Style Scope ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          { content: 'First slide', sortOrder: 0 },
          { content: 'Second slide', sortOrder: 1 },
        ],
      },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${created.id}`)
      await page.waitForLoadState('networkidle')

      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(2, {
        timeout: 10000,
      })
      await page.getByTestId('stage-thumbnail').nth(1).click()
      await page.getByTestId('slide-style-italic').click()

      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/songs/${created.id}`)
            const { data } = await res.json()
            return data.slides.map(
              (slide: { styleOverrides: unknown }) => slide.styleOverrides,
            )
          },
          { timeout: 10000 },
        )
        .toEqual([null, { italic: true }])
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('shows the current slide and the slide count', async ({
    page,
    request,
  }) => {
    const title = `E2E Slide Counter ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          { content: 'First slide', sortOrder: 0 },
          { content: 'Second slide', sortOrder: 1 },
          { content: 'Third slide', sortOrder: 2 },
        ],
      },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${created.id}`)
      await page.waitForLoadState('networkidle')

      const counter = page.getByTestId('slide-counter')
      await expect(counter).toHaveText('1 / 3', { timeout: 10000 })

      await page.getByTestId('stage-thumbnail').nth(2).click()
      await expect(counter).toHaveText('3 / 3')
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })
})
