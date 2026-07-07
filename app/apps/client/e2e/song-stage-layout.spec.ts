import { expect, test } from '@playwright/test'

/**
 * "Editing layout" preference: operators can choose between the normal song page
 * (slides edited in the left panel) and the PowerPoint layout, where slides are
 * edited directly on the song page via the stage editor. The preference is a
 * per-device localStorage value ('song-editor-layout').
 */
test.describe('Song editing layout preference', () => {
  test('powerpoint layout edits slides directly on the song page', async ({
    page,
    request,
  }) => {
    const title = `E2E Layout PP ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        keyLine: 'Do Major',
        slides: [
          { content: 'Verse one', sortOrder: 0 },
          { content: 'Verse two', sortOrder: 1 },
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

      // The song PAGE itself is the stage editor (no /edit, no tab). It opens in
      // Navigate mode; switch on editing to type on the slide.
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(2, {
        timeout: 10000,
      })
      await page.getByTestId('stage-edit-toggle').click()
      const editable = page.getByTestId('slide-canvas-editable')
      await expect(editable).toBeVisible({ timeout: 10000 })
      await expect(editable).toContainText('Verse one')

      // Edit lyrics in place — the change autosaves.
      await editable.click()
      await page.keyboard.press('ControlOrMeta+a')
      await page.keyboard.type('Verse one EDITED')

      // Autosave persists the edit (slides-only update keeps the keyLine).
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/songs/${created.id}`)
            const { data } = await res.json()
            return data.slides
              .map((s: { content: string }) => s.content)
              .join('\n')
          },
          { timeout: 10000 },
        )
        .toContain('Verse one EDITED')

      const res = await request.get(`/api/songs/${created.id}`)
      const { data: song } = await res.json()
      expect(song.keyLine).toBe('Do Major')
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('powerpoint layout has working prev/next presentation controls', async ({
    page,
    request,
  }) => {
    const title = `E2E Layout Nav ${Date.now()}`
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

      const prev = page.getByTestId('stage-prev')
      const next = page.getByTestId('stage-next')

      // Before presenting, both navigation buttons are visible but disabled.
      await expect(next).toBeVisible({ timeout: 10000 })
      await expect(prev).toBeDisabled()
      await expect(next).toBeDisabled()

      // Start presenting from the first slide.
      await page.getByTestId('stage-present').click()

      // Now Next is enabled and Prev stays disabled (we're on slide 0).
      await expect(next).toBeEnabled({ timeout: 10000 })
      await expect(prev).toBeDisabled()

      // Advancing enables Prev (we moved off the first slide).
      await next.click()
      await expect(prev).toBeEnabled({ timeout: 10000 })

      // The buttons keep working after switching to Edit mode.
      await page.getByTestId('stage-edit-toggle').click()
      await expect(next).toBeEnabled()
      await expect(prev).toBeEnabled()

      // Hide to stop the presentation.
      await page.getByTestId('stage-hide').click()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('the stage canvas follows the live slide when navigating Next/Prev', async ({
    page,
    request,
  }) => {
    const title = `E2E Nav Sync ${Date.now()}`
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

      const thumbs = page.getByTestId('stage-thumbnail')
      await expect(thumbs).toHaveCount(3, { timeout: 10000 })
      const next = page.getByTestId('stage-next')
      const prev = page.getByTestId('stage-prev')

      // Present from the first slide — the canvas selection sits on slide 0.
      await page.getByTestId('stage-present').click()
      await expect(next).toBeEnabled({ timeout: 10000 })
      await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true')

      // Advancing the live presentation MUST move the stage with it: the canvas
      // selection follows to slide 1, then slide 2 (regression: it stayed on 0).
      await next.click()
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
      await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'false')

      await next.click()
      await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true')

      // Retreating syncs back the other way too.
      await prev.click()
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')

      await page.getByTestId('stage-hide').click()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('edit-mode toggle switches the canvas between editable and read-only', async ({
    page,
    request,
  }) => {
    const title = `E2E Edit Toggle ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: { title, slides: [{ content: 'A slide', sortOrder: 0 }] },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${created.id}`)
      await page.waitForLoadState('networkidle')

      // Default: Navigate mode → the canvas is read-only (not editable).
      await expect(page.getByTestId('stage-edit-toggle')).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByTestId('slide-canvas-editable')).toHaveCount(0)

      // Turn editing on → the canvas becomes editable.
      await page.getByTestId('stage-edit-toggle').click()
      await expect(page.getByTestId('slide-canvas-editable')).toBeVisible()

      // Turn it back off → read-only again.
      await page.getByTestId('stage-edit-toggle').click()
      await expect(page.getByTestId('slide-canvas-editable')).toHaveCount(0)
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('projecting a slide does not move the edited slide', async ({
    page,
    request,
  }) => {
    const title = `E2E Project ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          { content: 'Slide A', sortOrder: 0 },
          { content: 'Slide B', sortOrder: 1 },
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

      // Turn editing on and edit the first slide on the canvas.
      await expect(page.getByTestId('stage-edit-toggle')).toBeVisible({
        timeout: 10000,
      })
      await page.getByTestId('stage-edit-toggle').click()
      const editable = page.getByTestId('slide-canvas-editable')
      await expect(editable).toContainText('Slide A', { timeout: 10000 })

      // Project the SECOND slide from its thumbnail button.
      await page.getByTestId('thumb-project').nth(1).click()

      // The presentation starts (Next becomes enabled)...
      await expect(page.getByTestId('stage-next')).toBeEnabled({
        timeout: 10000,
      })
      // ...but the slide under edit on the canvas is unchanged.
      await expect(editable).toContainText('Slide A')

      await page.getByTestId('stage-hide').click()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('navigate mode: clicking selects (no project); the green button projects', async ({
    page,
    request,
  }) => {
    const title = `E2E Nav Select ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          { content: 'One', sortOrder: 0 },
          { content: 'Two', sortOrder: 1 },
          { content: 'Three', sortOrder: 2 },
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

      const thumbs = page.getByTestId('stage-thumbnail')
      await expect(thumbs).toHaveCount(3, { timeout: 10000 })

      // Navigate mode (default): clicking the 2nd slide only SELECTS it (it
      // becomes current) and does NOT project — nothing goes live.
      await thumbs.nth(1).click()
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
      await expect(page.getByTestId('stage-next')).toBeDisabled()

      // The per-slide green project button IS available in Navigate mode and
      // projects the slide (presentation starts).
      await page.getByTestId('thumb-project').nth(1).click()
      await expect(page.getByTestId('stage-next')).toBeEnabled({
        timeout: 10000,
      })

      await page.getByTestId('stage-hide').click()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('switching to Edit keeps the slide you are on (not the first)', async ({
    page,
    request,
  }) => {
    const title = `E2E Edit Current ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          { content: 'One', sortOrder: 0 },
          { content: 'Two', sortOrder: 1 },
          { content: 'Three', sortOrder: 2 },
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

      // In Navigate mode, select the 2nd slide, then switch to Edit.
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(3, {
        timeout: 10000,
      })
      await page.getByTestId('stage-thumbnail').nth(1).click()
      await page.getByTestId('stage-edit-toggle').click()

      // Editing opens on the slide we were on (the 2nd), not the first.
      const editable = page.getByTestId('slide-canvas-editable')
      await expect(editable).toContainText('Two', { timeout: 10000 })
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('normal layout keeps the classic song page', async ({
    page,
    request,
  }) => {
    const title = `E2E Layout Normal ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: { title, slides: [{ content: 'Only slide', sortOrder: 0 }] },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'normal')
      })

      await page.goto(`/songs/${created.id}`)
      await page.waitForLoadState('networkidle')

      // Classic page: the slides panel is shown, the stage canvas is not.
      await expect(page.getByTestId('song-slide-0')).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByTestId('slide-canvas-editable')).toHaveCount(0)
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })
})
