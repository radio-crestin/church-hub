import { expect, test } from '@playwright/test'

/**
 * Verifies the song-category "hide/show" feature:
 *  - hiding a category removes its songs from the song list AND search,
 *  - the category itself is still returned to admins (with isHidden=1) so it
 *    can be re-shown,
 *  - showing it again restores its songs.
 *
 * Nothing is deleted — the song row survives the whole cycle.
 */

test.describe('Song category hide/show', () => {
  test('hiding a category hides its songs (list + search); showing restores them', async ({
    request,
  }) => {
    const stamp = `${Date.now()}`
    const catName = `E2E Hide Cat ${stamp}`
    const songTitle = `E2E HiddenSong ${stamp}`

    const catRes = await request.post('/api/categories', {
      data: { name: catName, priority: 1 },
    })
    expect([200, 201]).toContain(catRes.status())
    const category = (await catRes.json()).data
    expect(category.isHidden).toBe(0)
    const catId = category.id as number

    const songRes = await request.post('/api/songs', {
      data: {
        title: songTitle,
        categoryId: catId,
        slides: [{ content: 'a hidden verse', type: 'verse' }],
      },
    })
    expect([201, 409]).toContain(songRes.status())
    const songId = (await songRes.json()).data.id as number

    // Scope the list to this category (the seeded test DB has many songs, so an
    // unscoped page could miss ours). When the category is hidden, the server's
    // exclusion makes even this category-scoped query return nothing.
    const listHasSong = async (): Promise<boolean> => {
      const r = await request.get(
        `/api/songs?categoryIds=${catId}&limit=500&offset=0`,
      )
      const { data } = await r.json()
      return data.songs.some((s: { id: number }) => s.id === songId)
    }
    const searchHasSong = async (): Promise<boolean> => {
      const r = await request.get(
        `/api/songs/search?q=${encodeURIComponent('HiddenSong')}`,
      )
      const { data } = await r.json()
      return data.some((s: { id: number }) => s.id === songId)
    }

    try {
      // Visible initially (list + search).
      expect(await listHasSong()).toBe(true)
      expect(await searchHasSong()).toBe(true)

      // Hide the category.
      const hideRes = await request.post('/api/categories', {
        data: { id: catId, name: catName, isHidden: 1 },
      })
      expect(hideRes.ok()).toBeTruthy()
      expect((await hideRes.json()).data.isHidden).toBe(1)

      // The song is gone from both the list and search…
      expect(await listHasSong()).toBe(false)
      expect(await searchHasSong()).toBe(false)

      // …but the category still exists for admins (flagged hidden).
      const cats = (await (await request.get('/api/categories')).json())
        .data as Array<{ id: number; isHidden: number }>
      const stillThere = cats.find((c) => c.id === catId)
      expect(stillThere?.isHidden).toBe(1)

      // Show it again → the song reappears (nothing was deleted).
      const showRes = await request.post('/api/categories', {
        data: { id: catId, name: catName, isHidden: 0 },
      })
      expect(showRes.ok()).toBeTruthy()
      expect(await listHasSong()).toBe(true)
      expect(await searchHasSong()).toBe(true)
    } finally {
      await request.delete(`/api/songs/${songId}`).catch(() => {})
      await request.delete(`/api/categories/${catId}`).catch(() => {})
    }
  })

  test('a hidden category song is excluded from version "possible matches"', async ({
    request,
  }) => {
    const stamp = `${Date.now()}`
    // Identical lyrics + near-identical titles so the candidate scores as a
    // strong version match. The candidate lives in the category we will hide.
    const lyrics = [
      { content: `Slava Domnului in veci match ${stamp}`, type: 'verse' },
      { content: `Cantam impreuna o cantare noua ${stamp}`, type: 'chorus' },
    ]

    const catRes = await request.post('/api/categories', {
      data: { name: `E2E Match Cat ${stamp}`, priority: 1 },
    })
    const catId = (await catRes.json()).data.id as number

    const subjectRes = await request.post('/api/songs', {
      data: { title: `E2E Match Alpha ${stamp}`, slides: lyrics },
    })
    const subjectId = (await subjectRes.json()).data.id as number

    const candidateRes = await request.post('/api/songs', {
      data: {
        title: `E2E Match Beta ${stamp}`,
        categoryId: catId,
        slides: lyrics,
      },
    })
    const candidateId = (await candidateRes.json()).data.id as number

    const similarHasCandidate = async (): Promise<boolean> => {
      const r = await request.get(`/api/songs/${subjectId}/similar?limit=20`)
      const { data } = await r.json()
      return data.some((s: { songId: number }) => s.songId === candidateId)
    }

    try {
      // Precondition: the candidate is suggested as a possible match.
      expect(await similarHasCandidate()).toBe(true)

      // Hiding the candidate's category drops it from the suggestions.
      const hideRes = await request.post('/api/categories', {
        data: { id: catId, name: `E2E Match Cat ${stamp}`, isHidden: 1 },
      })
      expect(hideRes.ok()).toBeTruthy()
      expect(await similarHasCandidate()).toBe(false)

      // Showing it again brings the match back.
      await request.post('/api/categories', {
        data: { id: catId, name: `E2E Match Cat ${stamp}`, isHidden: 0 },
      })
      expect(await similarHasCandidate()).toBe(true)
    } finally {
      await request.delete(`/api/songs/${subjectId}`).catch(() => {})
      await request.delete(`/api/songs/${candidateId}`).catch(() => {})
      await request.delete(`/api/categories/${catId}`).catch(() => {})
    }
  })
})
