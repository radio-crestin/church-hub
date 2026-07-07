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

      // The song PAGE itself is the stage editor (no /edit, no tab). Editing is
      // implicit: the stage shows the slide read-only until you click it.
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(2, {
        timeout: 10000,
      })
      const stage = page.locator('[data-editing]')
      await expect(stage).toContainText('Verse one', { timeout: 10000 })
      await expect(page.getByTestId('slide-canvas-editable')).toHaveCount(0)

      // Click the stage to start editing → the in-place editor appears.
      await stage.click()
      const editable = page.getByTestId('slide-canvas-editable')
      await expect(editable).toBeVisible()

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

      // Before presenting, the buttons are ENABLED (more than one slide): they
      // browse the slides on the canvas without projecting anything.
      await expect(next).toBeVisible({ timeout: 10000 })
      await expect(prev).toBeEnabled()
      await expect(next).toBeEnabled()

      // Start presenting from the first slide.
      await page.getByTestId('stage-present').click()

      // Now Next is enabled and Prev stays disabled (we're on slide 0).
      await expect(next).toBeEnabled({ timeout: 10000 })
      await expect(prev).toBeDisabled()

      // Advancing enables Prev (we moved off the first slide).
      await next.click()
      await expect(prev).toBeEnabled({ timeout: 10000 })

      // The buttons keep working even after the operator clicks into the canvas
      // to edit (clicking a button blurs the editor and still navigates).
      await page.locator('[data-editing]').click()
      await expect(page.getByTestId('slide-canvas-editable')).toBeVisible()
      await expect(next).toBeEnabled()
      await expect(prev).toBeEnabled()

      // Hide to stop the presentation.
      await page.getByTestId('stage-hide').click()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('arrow keys move the stage in sync with the live slide', async ({
    page,
    request,
  }) => {
    const title = `E2E Kbd Sync ${Date.now()}`
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

      // Present, then drive with the keyboard — the canvas must follow. Wait
      // for the Hide button (only shown while live) so navigation drives the
      // projection, not a local selection step.
      await page.getByTestId('stage-present').click()
      await expect(page.getByTestId('stage-hide')).toBeVisible({
        timeout: 10000,
      })
      await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true')

      await page.keyboard.press('ArrowRight')
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')

      await page.keyboard.press('ArrowRight')
      await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true')

      await page.keyboard.press('ArrowLeft')
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')

      await page.getByTestId('stage-hide').click()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('Next/Prev browse the canvas when nothing is projected', async ({
    page,
    request,
  }) => {
    const title = `E2E Browse ${Date.now()}`
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

      // Nothing is projected — Next/Prev just move the canvas selection.
      await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true')
      await next.click()
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
      // Still not presenting — the Hide button never appears.
      await expect(page.getByTestId('stage-hide')).toHaveCount(0)

      await next.click()
      await expect(thumbs.nth(2)).toHaveAttribute('aria-current', 'true')
      await prev.click()
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
      await expect(page.getByTestId('stage-hide')).toHaveCount(0)
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('powerpoint layout shows a collapsible Marcaje/Versiuni column', async ({
    page,
    request,
  }) => {
    const title = `E2E PP Panel ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: { title, slides: [{ content: 'Only slide', sortOrder: 0 }] },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
        // Ensure the column starts visible regardless of prior device state.
        window.localStorage.setItem('song-detail:accordion-column-visible', 'true')
      })
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${created.id}`)
      await page.waitForLoadState('networkidle')

      // The Versiuni panel (with the current-song row) rides along in the
      // PowerPoint layout, just like the classic page.
      await expect(page.getByTestId('version-current-row')).toBeVisible({
        timeout: 10000,
      })

      // The whole column collapses/expands from the rail toggle.
      await page.getByTestId('pp-accordion-toggle').click()
      await expect(page.getByTestId('version-current-row')).toHaveCount(0)
      await page.getByTestId('pp-accordion-toggle').click()
      await expect(page.getByTestId('version-current-row')).toBeVisible()
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
      // Wait for Hide (only shown while live) so Next drives the projection.
      await page.getByTestId('stage-present').click()
      await expect(page.getByTestId('stage-hide')).toBeVisible({
        timeout: 10000,
      })
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

  test('editing is implicit: click the stage to edit, change slide to stop', async ({
    page,
    request,
  }) => {
    const title = `E2E Focus Edit ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          { content: 'A slide', sortOrder: 0 },
          { content: 'B slide', sortOrder: 1 },
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

      // No Edit/Navigate toggle exists — editing is implicit.
      await expect(page.getByTestId('stage-edit-toggle')).toHaveCount(0)

      // Initially the stage is read-only: no in-place editor, no border.
      const stage = page.locator('[data-editing]')
      const editable = page.getByTestId('slide-canvas-editable')
      await expect(stage).toContainText('A slide', { timeout: 10000 })
      await expect(stage).toHaveAttribute('data-editing', 'false')
      await expect(editable).toHaveCount(0)

      // Clicking the stage starts editing → the in-place editor + border appear.
      await stage.click()
      await expect(stage).toHaveAttribute('data-editing', 'true')
      await expect(editable).toBeVisible()

      // Changing slide (clicking a thumbnail) auto-exits editing: the editor is
      // gone, the border is gone, and the caret never lands on the new slide.
      const thumbs = page.getByTestId('stage-thumbnail')
      await thumbs.nth(1).click()
      await expect(stage).toHaveAttribute('data-editing', 'false')
      await expect(editable).toHaveCount(0)
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
      await expect(stage).toContainText('B slide')

      // Clicking the stage again starts editing the new slide.
      await stage.click()
      await expect(stage).toHaveAttribute('data-editing', 'true')
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

      // The canvas shows the first slide, which is the selected one.
      const stage = page.locator('[data-editing]')
      const thumbs = page.getByTestId('stage-thumbnail')
      await expect(stage).toContainText('Slide A', { timeout: 10000 })
      await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true')

      // Project the SECOND slide from its thumbnail button.
      await page.getByTestId('thumb-project').nth(1).click()

      // The presentation starts (Hide appears)...
      await expect(page.getByTestId('stage-hide')).toBeVisible({
        timeout: 10000,
      })
      // ...but the selected/shown slide on the canvas is unchanged (still A).
      await expect(thumbs.nth(0)).toHaveAttribute('aria-current', 'true')
      await expect(stage).toContainText('Slide A')

      await page.getByTestId('stage-hide').click()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('clicking a thumbnail selects (no project); the green button projects', async ({
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
      // becomes current) and does NOT project — nothing goes live (the Hide
      // button, which only appears while presenting, stays absent).
      await thumbs.nth(1).click()
      await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
      await expect(page.getByTestId('stage-hide')).toHaveCount(0)

      // The per-slide green project button IS available in Navigate mode and
      // projects the slide (presentation starts → Hide appears).
      await page.getByTestId('thumb-project').nth(1).click()
      await expect(page.getByTestId('stage-hide')).toBeVisible({
        timeout: 10000,
      })

      await page.getByTestId('stage-hide').click()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('clicking a slide then editing keeps you on that slide (not the first)', async ({
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

      // Select the 2nd slide, then click into the canvas to edit it.
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(3, {
        timeout: 10000,
      })
      await page.getByTestId('stage-thumbnail').nth(1).click()

      // The canvas shows the slide we selected (the 2nd), not the first.
      const stage = page.locator('[data-editing]')
      await expect(stage).toContainText('Two', { timeout: 10000 })

      // Clicking the stage edits that same slide (still the 2nd).
      await stage.click()
      const editable = page.getByTestId('slide-canvas-editable')
      await expect(editable).toContainText('Two')
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
