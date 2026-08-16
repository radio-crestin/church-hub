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
      await expect
        .poll(renderedFontSize, { timeout: 5000 })
        .toBeGreaterThan(before)
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
      await expect(page.locator('[data-editing]')).toContainText(
        'First slide',
        {
          timeout: 10000,
        },
      )
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

      // The styled run stays inline. As a flex item it would be blockified —
      // each run and each line break taking a full row, which split words and
      // pushed the lines apart while editing.
      expect(
        await editable.evaluate((el) => getComputedStyle(el).display),
      ).not.toBe('flex')
      expect(
        await editable.evaluate(
          (el) =>
            getComputedStyle(el.querySelector('span') as HTMLElement).display,
        ),
      ).toBe('inline')

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

  test('a live song picks up edits made on the stage', async ({ request }) => {
    const title = `E2E Slide Style Live ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          {
            content: 'First slide',
            sortOrder: 0,
            chords: [{ wordIndex: 0, chord: 'G' }],
          },
          { content: 'Second slide', sortOrder: 1 },
        ],
      },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    const liveSlides = async () => {
      const response = await request.get('/api/presentation/state')
      const { data } = await response.json()
      return data.temporaryContent?.data?.slides as Array<{
        content: string
        chords: unknown
        styleOverrides: unknown
      }>
    }

    try {
      expect(
        (
          await request.post('/api/presentation/temporary-song', {
            data: { songId: created.id },
          })
        ).status(),
      ).toBe(200)

      // Edit the live song the way the stage editor's autosave does.
      const edited = await request.post('/api/songs', {
        data: {
          id: created.id,
          title,
          slides: created.slides.map(
            (
              slide: { id: number; content: string; chords: unknown },
              index: number,
            ) => ({
              id: slide.id,
              content: index === 0 ? 'First slide EDITED' : slide.content,
              chords: slide.chords,
              sortOrder: index,
              styleOverrides:
                index === 0 ? { fontScale: 1.4, bold: true } : null,
            }),
          ),
        },
      })
      expect(edited.status()).toBe(200)

      // The projection snapshot follows: new lyrics, new styling, and the
      // chords are still there.
      const slides = await liveSlides()
      expect(slides[0].content).toContain('First slide EDITED')
      expect(slides[0].styleOverrides).toEqual({ fontScale: 1.4, bold: true })
      expect(slides[0].chords).toEqual([{ wordIndex: 0, chord: 'G' }])
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('the size input sets an exact size for slide and selection', async ({
    page,
    request,
  }) => {
    const title = `E2E Slide Style Size ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: { title, slides: [{ content: 'Slava Tie Doamne', sortOrder: 0 }] },
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
      await expect(stage).toContainText('Slava', { timeout: 10000 })
      await stage.click()

      const sizeInput = page.getByTestId('slide-style-font-size')
      await expect(sizeInput).toBeVisible()
      // The field reports the size the slide is actually rendered at.
      await expect
        .poll(async () => Number(await sizeInput.inputValue()), {
          timeout: 5000,
        })
        .toBeGreaterThan(0)
      const shown = Number(await sizeInput.inputValue())

      // Typing a smaller size shrinks the whole slide by that ratio.
      await sizeInput.fill(String(Math.round(shown / 2)))
      await sizeInput.press('Enter')
      await expect
        .poll(readOverride, { timeout: 10000 })
        .toMatchObject({ fontScale: expect.any(Number) })
      const slideOverride = await readOverride()
      expect(slideOverride.fontScale).toBeLessThan(1)
      expect(slideOverride.ranges ?? []).toHaveLength(0)

      // The field follows the change instead of keeping the old number.
      await expect
        .poll(async () => Number(await sizeInput.inputValue()), {
          timeout: 5000,
        })
        .toBeLessThan(shown)

      // With a word selected, the same field sizes only that word.
      const editable = page.getByTestId('slide-canvas-editable')
      await editable.evaluate((el) => {
        const textNode = el.firstChild
        if (!textNode) throw new Error('editor has no text')
        const range = document.createRange()
        range.setStart(textNode, 0)
        range.setEnd(textNode, 5)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      })
      // The bar reads the selection from a selectionchange event; give it the
      // tick it needs before acting on the field.
      await page.waitForTimeout(300)
      await expect
        .poll(async () => Number(await sizeInput.inputValue()), {
          timeout: 5000,
        })
        .toBeGreaterThan(0)
      const wordSize = Number(await sizeInput.inputValue())
      await sizeInput.fill(String(wordSize * 2))
      await sizeInput.press('Enter')

      // Autosave carries it, and only the selected run is affected.
      await expect
        .poll(async () => (await readOverride())?.ranges?.length ?? 0, {
          timeout: 10000,
        })
        .toBe(1)
      const withRange = await readOverride()
      expect(withRange.fontScale).toBeCloseTo(slideOverride.fontScale, 5)
      expect(withRange.ranges[0]).toMatchObject({ start: 0, end: 5 })
      expect(withRange.ranges[0].fontScale).toBeGreaterThan(1)
      expect(await editable.innerHTML()).toContain('font-size:')

      // The words stay selected afterwards, so a second size change still
      // targets them instead of falling back to the whole slide.
      const secondSize = Number(await sizeInput.inputValue())
      await sizeInput.fill(String(secondSize * 2))
      await sizeInput.press('Enter')
      await expect
        .poll(async () => (await readOverride())?.ranges?.[0]?.fontScale ?? 0, {
          timeout: 10000,
        })
        .toBeGreaterThan(withRange.ranges[0].fontScale)
      const after = await readOverride()
      expect(after.ranges).toHaveLength(1)
      expect(after.fontScale).toBeCloseTo(slideOverride.fontScale, 5)
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('the size field applies without leaving edit mode', async ({
    page,
    request,
  }) => {
    const title = `E2E Slide Style Live Size ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: { title, slides: [{ content: 'Slava Tie Doamne', sortOrder: 0 }] },
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
      await expect(stage).toContainText('Slava', { timeout: 10000 })
      await stage.click()

      const sizeInput = page.getByTestId('slide-style-font-size')
      await expect(sizeInput).toBeVisible()
      await page.waitForTimeout(300)
      const shown = Number(await sizeInput.inputValue())

      // Nudge the spinner: no Enter, no blur, still inside edit mode.
      await sizeInput.click()
      await sizeInput.press('ArrowUp')

      await expect
        .poll(async () => (await readOverride())?.fontScale ?? 0, {
          timeout: 10000,
        })
        .toBeGreaterThan(0)
      // The editor is still mounted — the change did not need it to close.
      await expect(page.getByTestId('slide-canvas-editable')).toBeVisible()
      await expect
        .poll(async () => Number(await sizeInput.inputValue()), {
          timeout: 5000,
        })
        .toBeGreaterThan(shown)
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('a styled slide is projected at its own size right away', async ({
    page,
    request,
  }) => {
    const title = `E2E Slide Style Project ${Date.now()}`
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

    const liveSlides = async () => {
      const response = await request.get('/api/presentation/state')
      const { data } = await response.json()
      return (data.temporaryContent?.data?.slides ?? []) as Array<{
        styleOverrides: { fontScale?: number } | null
      }>
    }

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${created.id}`)
      await page.waitForLoadState('networkidle')

      // Style the second slide, then project without pausing — the styling must
      // reach the projection with the navigation, not a second later.
      await page.getByTestId('stage-thumbnail').nth(1).click()
      await page.locator('[data-editing]').click()
      await page.getByTestId('slide-style-font-increase').click()
      await page.getByTestId('stage-present').click()
      await expect
        .poll(async () => (await liveSlides()).length, { timeout: 10000 })
        .toBeGreaterThan(1)
      await page.getByTestId('stage-next').click()

      const slides = await liveSlides()
      expect(slides.length).toBeGreaterThan(1)
      expect(slides[1].styleOverrides?.fontScale).toBeGreaterThan(1)
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('styling a selection reaches the projection', async ({
    page,
    request,
  }) => {
    const title = `E2E Slide Style Live Range ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: { title, slides: [{ content: 'Slava Tie Doamne', sortOrder: 0 }] },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    const liveRanges = async () => {
      const response = await request.get('/api/presentation/state')
      const { data } = await response.json()
      return (data.temporaryContent?.data?.slides?.[0]?.styleOverrides
        ?.ranges ?? []) as Array<{ fontScale?: number }>
    }

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${created.id}`)
      await page.waitForLoadState('networkidle')

      await page.getByTestId('stage-present').click()
      await expect
        .poll(async () => (await liveRanges()).length, { timeout: 10000 })
        .toBe(0)

      // Open the projection the way a screen window does, then style a word.
      const screensResponse = await request.get('/api/screens')
      const { data: screens } = await screensResponse.json()
      const projection = await page.context().newPage()
      await projection.goto(`/screen/${screens[0].id}`)
      await projection.waitForLoadState('networkidle')

      await page.bringToFront()
      await page.locator('[data-editing]').click()
      const editable = page.getByTestId('slide-canvas-editable')
      await editable.evaluate((el) => {
        const textNode = el.firstChild
        if (!textNode) throw new Error('editor has no text')
        const range = document.createRange()
        range.setStart(textNode, 0)
        range.setEnd(textNode, 5)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      })
      await page.waitForTimeout(300)
      const sizeInput = page.getByTestId('slide-style-font-size')
      const size = Number(await sizeInput.inputValue())
      await sizeInput.fill(String(size * 2))
      await sizeInput.press('Enter')

      // The live snapshot carries the run, and the already-open projection
      // picks it up without being reloaded.
      await expect
        .poll(async () => (await liveRanges())[0]?.fontScale ?? 0, {
          timeout: 10000,
        })
        .toBeGreaterThan(1)
      await expect
        .poll(async () => projection.locator('body').innerHTML(), {
          timeout: 10000,
        })
        .toContain('slide-style-0-5')
      await projection.close()
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
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
