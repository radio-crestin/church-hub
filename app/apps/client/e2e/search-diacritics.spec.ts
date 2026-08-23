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
  return (await response.json()).data as Array<{
    id: number
    title: string
    highlightedTitle: string
    matchedContent: string
  }>
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

  test('one word, every spelling: hyphen, apostrophe, joined, with î', async ({
    request,
  }) => {
    // "ne-ncetat", "ne'ncetat", "nencetat" and "neîncetat" are the same
    // word in Romanian songbooks; whichever one the operator types has to
    // find all of them, title first, and the mark has to cover the sign.
    // A made-up word with the same shape keeps the real songbook out of it.
    const uniq = Date.now()
    const hyphen = await createSong(
      request,
      `Doamne ne-ncezat Te lăudăm ${uniq}`,
      'Doamne, ne-ncezat Te lăudăm',
    )
    const apostrophe = await createSong(
      request,
      `Mulțimea Te-nconjoară ${uniq}`,
      "Mulțimea Te-nconjoară, Isuse, ne'ncezat privirea",
    )
    const joined = await createSong(
      request,
      `Spune-ți nencezat la toți ${uniq}`,
      'Spune-ți nencezat la toți să știe',
    )
    const withI = await createSong(
      request,
      `Te lăudăm neîncezat ${uniq}`,
      'Te lăudăm neîncezat căci meriți',
    )
    const all = [hyphen, apostrophe, joined, withI]

    try {
      for (const query of ['ne-ncezat', "ne'ncezat", 'nencezat', 'neîncezat']) {
        const results = await search(request, query)
        const ids = results.map((song) => song.id)
        for (const song of all) expect(ids, query).toContain(song.id)

        // The three with the word in the title come before the lyrics-only one.
        const lyricsOnlyIndex = ids.indexOf(apostrophe.id)
        for (const song of [hyphen, joined, withI]) {
          expect(ids.indexOf(song.id), query).toBeLessThan(lyricsOnlyIndex)
        }
      }

      // The mark covers the whole word, sign included, in title and lyrics.
      const results = await search(request, 'ne-ncezat')
      const byId = new Map(results.map((song) => [song.id, song]))
      expect(byId.get(hyphen.id)?.highlightedTitle).toContain(
        '<mark>ne-ncezat</mark>',
      )
      expect(byId.get(withI.id)?.highlightedTitle).toContain(
        '<mark>neîncezat</mark>',
      )
      expect(byId.get(joined.id)?.highlightedTitle).toContain(
        '<mark>nencezat</mark>',
      )
      expect(byId.get(apostrophe.id)?.matchedContent).toMatch(
        /<mark>ne(?:'|&#0?39;|’)ncezat<\/mark>/,
      )
    } finally {
      for (const song of all) {
        await request.delete(`/api/songs/${song.id}`).catch(() => {})
      }
    }
  })
})
