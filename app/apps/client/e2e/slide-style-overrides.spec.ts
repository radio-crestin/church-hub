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

      const stage = page.locator('[data-editing]')
      await expect(stage).toContainText('First slide', { timeout: 10000 })

      // The formatting bar belongs to the editor: it is absent until the
      // operator clicks the stage to start editing.
      const toolbar = page.getByTestId('slide-style-toolbar')
      await expect(toolbar).toHaveCount(0)
      await stage.click()
      await expect(toolbar).toBeVisible()

      // A brand new slide follows the screen settings — no override stored.
      expect(await readOverride()).toBeNull()

      // Enlarge the slide's text and make it bold, then align it to the start.
      const editable = page.getByTestId('slide-canvas-editable')
      const renderedFontSize = async () =>
        Number.parseFloat(
          await editable.evaluate((el) => getComputedStyle(el).fontSize),
        )
      const before = await renderedFontSize()

      await page.getByTestId('slide-style-font-increase').click()
      // The size on screen actually grows — the scale is applied to the fitted
      // size, so it is not swallowed by the auto-fit ceiling.
      await expect.poll(renderedFontSize, { timeout: 5000 }).toBeGreaterThan(
        before,
      )
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
      await expect(page.locator('[data-editing]')).toContainText('First slide', {
        timeout: 10000,
      })
      await page.locator('[data-editing]').click()
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

  test('styles a selected word without touching the rest', async ({
    page,
    request,
  }) => {
    const title = `E2E Slide Style Word ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [{ content: 'Slava Tie Doamne', sortOrder: 0 }],
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

      const stage = page.locator('[data-editing]')
      await expect(stage).toContainText('Slava', { timeout: 10000 })
      await stage.click()

      const editable = page.getByTestId('slide-canvas-editable')
      await expect(editable).toBeVisible()
      // Select one word, then enlarge it and make it bold.
      await editable.dblclick()
      await page.getByTestId('slide-style-font-increase').click()
      await page.getByTestId('slide-style-bold').click()

      // The editor shows the styling straight away, not only after saving.
      await expect
        .poll(async () => editable.innerHTML(), { timeout: 5000 })
        .toContain('font-size:')
      expect(await editable.innerHTML()).toContain('<strong')

      // And it is stored as a range, leaving the rest of the slide alone.
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/songs/${created.id}`)
            const { data } = await res.json()
            return data.slides[0].styleOverrides
          },
          { timeout: 10000 },
        )
        .toMatchObject({ ranges: [{ bold: true }] })
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
      await page.locator('[data-editing]').click()
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
