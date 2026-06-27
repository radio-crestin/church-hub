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

      // The song PAGE itself shows the editable stage canvas (no /edit, no tab).
      const editable = page.getByTestId('slide-canvas-editable')
      await expect(editable).toBeVisible({ timeout: 10000 })
      await expect(editable).toContainText('Verse one')
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(2)

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

      // Hide to stop the presentation.
      await page.getByTestId('stage-hide').click()
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
