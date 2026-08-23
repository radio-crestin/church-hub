import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Song search must ignore diacritics in both directions and rank a title match
 * above a song that only mentions the words in its lyrics.
 */

async function createSong(
  request: APIRequestContext,
  title: string,
  lyrics: string,
) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: lyrics, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

async function search(request: APIRequestContext, query: string) {
  const response = await request.get(
    `/api/songs/search?q=${encodeURIComponent(query)}`,
  )
  expect(response.status()).toBe(200)
  return (await response.json()).data as Array<{ id: number; title: string }>
}

test.describe('Song search', () => {
  test('finds diacritics regardless of how the query is typed', async ({
    request,
  }) => {
    const uniq = Date.now()
    const withDiacritics = await createSong(
      request,
      `Cântare Împăratului ${uniq}`,
      'Slavă Ție',
    )

    try {
      const plain = await search(request, `Cantare Imparatului ${uniq}`)
      expect(plain.map((song) => song.id)).toContain(withDiacritics.id)

      const accented = await search(request, `Cântare Împăratului ${uniq}`)
      expect(accented.map((song) => song.id)).toContain(withDiacritics.id)
    } finally {
      await request.delete(`/api/songs/${withDiacritics.id}`).catch(() => {})
    }
  })

  test('ranks a title match above a lyrics-only match', async ({ request }) => {
    const uniq = Date.now()
    const lyricsMatch = await createSong(
      request,
      `E2E Rank Lyrics ${uniq}`,
      `Cântă inima mea ${uniq} ${uniq} ${uniq}`,
    )
    const titleMatch = await createSong(
      request,
      `Cântă inima mea ${uniq}`,
      'Alt text cu totul',
    )

    try {
      const results = await search(request, `Canta inima mea ${uniq}`)
      const ids = results.map((song) => song.id)
      expect(ids).toContain(titleMatch.id)
      expect(ids.indexOf(titleMatch.id)).toBeLessThan(
        ids.indexOf(lyricsMatch.id),
      )
    } finally {
      await request.delete(`/api/songs/${lyricsMatch.id}`).catch(() => {})
      await request.delete(`/api/songs/${titleMatch.id}`).catch(() => {})
    }
  })
})
