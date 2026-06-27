import { expect, test } from '@playwright/test'

/**
 * PowerPoint-style song editor: the "Slides" view of the song editor renders
 * each slide exactly as it will be projected (a filmstrip of true-to-projection
 * thumbnails + a large canvas) and lets the operator edit the lyrics directly on
 * the slide. These tests cover switching to the stage view, in-place editing,
 * and adding slides from the filmstrip.
 */
test.describe('Song stage editor (PowerPoint-style)', () => {
  test('edits lyrics in place on the slide canvas and persists them', async ({
    page,
    request,
  }) => {
    const title = `E2E Stage Editor ${Date.now()}`
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
      await page.goto(`/songs/${created.id}/edit`)
      await page.waitForLoadState('networkidle')

      // Editing an existing song opens straight into the PowerPoint-style stage
      // view — no extra toggle click needed. The filmstrip shows one
      // true-to-projection thumbnail per slide.
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(2, {
        timeout: 10000,
      })

      // The canvas renders the first slide and is editable in place.
      const editable = page.getByTestId('slide-canvas-editable')
      await expect(editable).toBeVisible({ timeout: 10000 })
      await expect(editable).toContainText('Verse one')

      // Edit the lyrics directly on the slide.
      await editable.click()
      await page.keyboard.press('ControlOrMeta+a')
      await page.keyboard.type('Verse one EDITED')
      await expect(editable).toContainText('Verse one EDITED')

      // Save with the editor shortcut; it navigates back to the detail page.
      await page.keyboard.press('ControlOrMeta+s')
      await expect(page).toHaveURL(new RegExp(`/songs/${created.id}$`), {
        timeout: 10000,
      })

      // The API confirms the edited verse and the preserved keyLine.
      const getResponse = await request.get(`/api/songs/${created.id}`)
      expect(getResponse.status()).toBe(200)
      const { data: song } = await getResponse.json()
      expect(song.keyLine).toBe('Do Major')
      const contents = song.slides
        .map((s: { content: string }) => s.content)
        .join('\n')
      expect(contents).toContain('Verse one EDITED')
      expect(contents).toContain('Verse two')
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('opens in stage view but can switch to the form', async ({
    page,
    request,
  }) => {
    const title = `E2E Stage Toggle ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: { title, slides: [{ content: 'Only slide', sortOrder: 0 }] },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    try {
      await page.goto(`/songs/${created.id}/edit`)
      await page.waitForLoadState('networkidle')

      // Default = stage view: the editable canvas is shown without any toggle.
      await expect(page.getByTestId('slide-canvas-editable')).toBeVisible({
        timeout: 10000,
      })

      // The Form toggle still switches to the metadata/form editor.
      await page.getByTestId('song-view-form').click()
      await expect(page.getByTestId('slide-canvas-editable')).toBeHidden()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('adds a slide from the filmstrip', async ({ page, request }) => {
    const title = `E2E Stage Add ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        slides: [{ content: 'Only slide', sortOrder: 0 }],
      },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    try {
      await page.goto(`/songs/${created.id}/edit`)
      await page.waitForLoadState('networkidle')

      // Opens directly in stage view with the single slide.
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(1, {
        timeout: 10000,
      })

      // Add a slide from the filmstrip — the thumbnail count grows.
      await page.getByTestId('stage-add-slide').click()
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(2)
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })
})
