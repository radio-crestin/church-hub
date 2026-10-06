import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Song discovery compares each candidate with the whole library through an
 * index kept in memory (T-124). It finds a version under another title, and
 * it sees songs added or changed after it was built.
 */

const LYRICS =
  'zorilandei cetatea straluceste peste muntii hermonului lumina blanda coboara in vale tacuta'

async function createSong(
  request: APIRequestContext,
  title: string,
  lyrics: string,
): Promise<number> {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `<p>${lyrics}</p>`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data.id as number
}

async function similarIds(
  request: APIRequestContext,
  title: string,
  lyrics: string,
): Promise<number[]> {
  const response = await request.post('/api/songs/discovery/match', {
    data: {
      candidates: [
        { tempId: 'candidate', title, lyrics, sourceFilename: null },
      ],
    },
  })
  expect(response.ok()).toBeTruthy()
  const [result] = (await response.json()).data as Array<{
    similar: Array<{ songId: number }>
  }>
  return result.similar.map((song) => song.songId)
}

test.describe('Song discovery library comparison', () => {
  test('finds a version under another title, and songs added or edited after the first comparison', async ({
    request,
  }) => {
    const uniq = Date.now()
    const created: number[] = []
    try {
      const original = await createSong(
        request,
        `Cetatea zorilor ${uniq}`,
        LYRICS,
      )
      created.push(original)

      // Same verses, a title sharing no word (not even the run's number,
      // which would count as a shared title word): found through the lyrics.
      expect(await similarIds(request, 'Imn de dimineata', LYRICS)).toContain(
        original,
      )

      // A song added after that comparison is found by the next one.
      const added = await createSong(
        request,
        `Lumina din vale ${uniq}`,
        'lumina blanda coboara in vale tacuta peste ape linistite si campii zambitoare',
      )
      created.push(added)
      expect(
        await similarIds(
          request,
          'Alt titlu',
          'lumina blanda coboara in vale tacuta peste ape linistite si campii zambitoare',
        ),
      ).toContain(added)

      // Edited to other verses, the original no longer matches the old ones.
      const edited = await request.post('/api/songs', {
        data: {
          id: original,
          title: `Cetatea zorilor ${uniq}`,
          slides: [
            {
              content:
                '<p>alte versuri cu totul despre marea albastra si corabii</p>',
              sortOrder: 0,
            },
          ],
        },
      })
      expect(edited.ok()).toBeTruthy()
      expect(
        await similarIds(request, 'Imn de dimineata', LYRICS),
      ).not.toContain(original)
    } finally {
      for (const id of created)
        await request.delete(`/api/songs/${id}`).catch(() => {})
    }
  })
})
