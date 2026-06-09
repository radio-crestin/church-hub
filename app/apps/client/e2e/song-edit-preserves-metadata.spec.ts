import { expect, test } from '@playwright/test'

/**
 * Regression tests: editing only the verses of a song (slides edit mode on
 * the song detail page) must NOT wipe the "gama melodie" (keyLine) or any
 * other metadata. The server may only update fields explicitly present in
 * the upsert payload; an explicit null still clears a field.
 */
test.describe('Song partial update preserves metadata', () => {
  test('slides-only update keeps keyLine and author (API)', async ({
    request,
  }) => {
    const title = `E2E KeyLine Song ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        keyLine: 'Do Major',
        author: 'E2E Author',
        slides: [{ content: 'Verse one', sortOrder: 0 }],
      },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()
    expect(created.keyLine).toBe('Do Major')

    try {
      // Update only the verses — exactly what slides edit mode sends
      const updateResponse = await request.post('/api/songs', {
        data: {
          id: created.id,
          title,
          slides: [{ content: 'Verse one edited', sortOrder: 0 }],
        },
      })
      expect(updateResponse.status()).toBe(200)
      const { data: updated } = await updateResponse.json()
      expect(updated.keyLine).toBe('Do Major')
      expect(updated.author).toBe('E2E Author')
      expect(updated.slides[0].content).toContain('Verse one edited')
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('keyLine-only update keeps author and slides (API)', async ({
    request,
  }) => {
    const title = `E2E KeyLine Only ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: {
        title,
        keyLine: 'Do Major',
        author: 'E2E Author',
        slides: [{ content: 'Verse one', sortOrder: 0 }],
      },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    try {
      // The song-key page sends exactly { id, title, keyLine }
      const updateResponse = await request.post('/api/songs', {
        data: { id: created.id, title, keyLine: 'Sol' },
      })
      expect(updateResponse.status()).toBe(200)
      const { data: updated } = await updateResponse.json()
      expect(updated.keyLine).toBe('Sol')
      expect(updated.author).toBe('E2E Author')
      expect(updated.slides).toHaveLength(1)
      expect(updated.slides[0].content).toContain('Verse one')
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('explicit null still clears keyLine (API)', async ({ request }) => {
    const title = `E2E KeyLine Clear ${Date.now()}`
    const createResponse = await request.post('/api/songs', {
      data: { title, keyLine: 'Do Major' },
    })
    expect(createResponse.status()).toBe(201)
    const { data: created } = await createResponse.json()

    try {
      const updateResponse = await request.post('/api/songs', {
        data: { id: created.id, title, keyLine: null },
      })
      expect(updateResponse.status()).toBe(200)
      const { data: updated } = await updateResponse.json()
      expect(updated.keyLine).toBeNull()
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })

  test('editing verses in slides edit mode keeps the keyLine (UI)', async ({
    page,
    request,
  }) => {
    const title = `E2E Edit Mode KeyLine ${Date.now()}`
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
      await page.goto(`/songs/${created.id}`)
      await page.waitForLoadState('networkidle')

      // The keyLine chip is visible before editing
      await expect(page.getByText('Do Major').first()).toBeVisible({
        timeout: 10000,
      })

      // Enter slides edit mode and change only the verses. Target the
      // slides editor by its placeholder — a generic `textarea` locator can
      // resolve to the hidden feedback-widget textarea instead.
      await page.getByTestId('toggle-slides-edit-mode').click()
      const textarea = page.getByPlaceholder(
        /first slide lyrics|versurile primului slide/i,
      )
      await expect(textarea).toBeVisible()
      await textarea.fill('Verse one edited\n\nVerse two edited')

      // Save and wait for edit mode to exit
      await page.getByTestId('save-slides-edit-mode').click()
      await expect(page.getByTestId('save-slides-edit-mode')).toBeHidden({
        timeout: 10000,
      })

      // The keyLine chip must still be there
      await expect(page.getByText('Do Major').first()).toBeVisible()

      // And the API confirms both the new verses and the preserved key
      const getResponse = await request.get(`/api/songs/${created.id}`)
      expect(getResponse.status()).toBe(200)
      const { data: song } = await getResponse.json()
      expect(song.keyLine).toBe('Do Major')
      const contents = song.slides
        .map((s: { content: string }) => s.content)
        .join('\n')
      expect(contents).toContain('Verse one edited')
      expect(contents).toContain('Verse two edited')
    } finally {
      await request.delete(`/api/songs/${created.id}`)
    }
  })
})
