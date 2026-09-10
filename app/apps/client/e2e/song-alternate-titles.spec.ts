import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Finding a song by the name it is actually known by.
 *
 * A library imported with "use the first verse as the title" files every song
 * under its opening line, and the name the source gave it used to be thrown
 * away: "Zece mii de motive" is stored as "E o nouă zi, soarele răsare", so
 * searching for the name anyone would type found nothing at all. The name is
 * now kept beside the title and indexed in the same band, so the song is
 * reachable by its real title, by its first verse and by any line of its
 * lyrics.
 *
 * Every query below carries a marker word so the assertions are about the
 * songs this test made, not about whatever else the library happens to hold.
 */

interface Created {
  id: number
  title: string
}

async function createSong(
  request: APIRequestContext,
  song: {
    title: string
    alternateTitles?: string[]
    lines: string[]
    sourceFilename?: string
  },
): Promise<Created> {
  const response = await request.post('/api/songs', {
    data: {
      title: song.title,
      alternateTitles: song.alternateTitles,
      sourceFilename: song.sourceFilename ?? null,
      slides: song.lines.map((content, sortOrder) => ({ content, sortOrder })),
    },
  })
  expect(response.status()).toBe(201)
  const { data } = await response.json()
  return { id: data.id as number, title: data.title as string }
}

async function search(request: APIRequestContext, query: string) {
  const response = await request.get(
    `/api/songs/search?q=${encodeURIComponent(query)}`,
  )
  expect(response.ok()).toBeTruthy()
  const { data } = await response.json()
  return data as Array<{ id: number; title: string; score: number }>
}

test.describe('A song is findable by every name it goes by', () => {
  const marker = `qzx${Date.now()}`
  let real: Created
  let decoy: Created
  let withoutAlternate: Created

  test.beforeAll(async ({ request }) => {
    // The song as the bulk import leaves it: filed under its first verse,
    // with the name it is really known by kept beside it.
    real = await createSong(request, {
      title: `E o nouă zi, soarele răsare ${marker}`,
      alternateTitles: [`Zece mii de motive ${marker}`],
      lines: [
        `E o nouă zi, soarele răsare ${marker}\nE vremea să cânt din nou`,
        `Cântă suflet al meu pentru Dumnezeu ${marker}\nCântă ca la început`,
      ],
    })

    // Carries the phrase in its lyrics only — it must be found, but never
    // ahead of the song the phrase actually names.
    decoy = await createSong(request, {
      title: `Alt cântec ${marker}`,
      lines: [`Am zece mii de motive ${marker} să mă bucur`],
    })

    // The control: same shape, no alternate title. It is what every song in
    // an already-imported library looks like.
    withoutAlternate = await createSong(request, {
      title: `Alta zi cu totul ${marker}`,
      lines: [`Un vers oarecare ${marker}`],
    })
  })

  test.afterAll(async ({ request }) => {
    for (const song of [real, decoy, withoutAlternate]) {
      if (song) await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('the real title finds it, ahead of a song that only quotes it', async ({
    request,
  }) => {
    const results = await search(request, `Zece mii de motive ${marker}`)
    const ids = results.map((r) => r.id)
    expect(ids).toContain(real.id)
    expect(ids).toContain(decoy.id)
    expect(ids.indexOf(real.id)).toBeLessThan(ids.indexOf(decoy.id))
  })

  test('part of the real title is enough', async ({ request }) => {
    const results = await search(request, `zece mii ${marker}`)
    expect(results.map((r) => r.id)).toContain(real.id)
  })

  test('the first verse finds it too', async ({ request }) => {
    const results = await search(request, `E o nouă zi ${marker}`)
    expect(results.map((r) => r.id)).toContain(real.id)
  })

  test('typed without diacritics, it is still the same song', async ({
    request,
  }) => {
    const results = await search(
      request,
      `e o noua zi soarele rasare ${marker}`,
    )
    expect(results.map((r) => r.id)).toContain(real.id)
  })

  test('the first line of the chorus finds it', async ({ request }) => {
    const results = await search(request, `Cântă suflet al meu ${marker}`)
    expect(results.map((r) => r.id)).toContain(real.id)
  })

  test('a fragment from the middle of a verse finds it', async ({
    request,
  }) => {
    const results = await search(request, `pentru Dumnezeu ${marker}`)
    expect(results.map((r) => r.id)).toContain(real.id)
  })

  test('a name the song does not go by does not find it', async ({
    request,
  }) => {
    // The control has no alternate title, so it stays unreachable by one —
    // which is exactly the state the fix rescues a library from.
    const results = await search(request, `Zece mii de motive ${marker}`)
    expect(results.map((r) => r.id)).not.toContain(withoutAlternate.id)
  })
})

test.describe('Recovering the titles of a library already imported', () => {
  test('a song gets its source title back, and searching finds it', async ({
    request,
  }) => {
    const marker = `qzy${Date.now()}`
    const filename = `${marker}.xml`
    const song = await createSong(request, {
      title: `Un prim vers oarecare ${marker}`,
      lines: [`Un prim vers oarecare ${marker}`],
      sourceFilename: filename,
    })

    try {
      // Before: the name the source knows it by finds nothing.
      expect(
        (await search(request, `Numele adevărat ${marker}`)).map((r) => r.id),
      ).not.toContain(song.id)

      const response = await request.post('/api/songs/alternate-titles', {
        data: {
          entries: [
            { sourceFilename: filename, titles: [`Numele adevărat ${marker}`] },
          ],
        },
      })
      expect(response.ok()).toBeTruthy()
      expect((await response.json()).data).toEqual({ matched: 1, updated: 1 })

      // After: it is reachable by that name, and its own title still works.
      await expect
        .poll(
          async () =>
            (await search(request, `Numele adevărat ${marker}`)).map(
              (r) => r.id,
            ),
          { timeout: 10000 },
        )
        .toContain(song.id)
      expect(
        (await search(request, `Un prim vers oarecare ${marker}`)).map(
          (r) => r.id,
        ),
      ).toContain(song.id)

      // Running it again changes nothing: the song already carries the name.
      const again = await request.post('/api/songs/alternate-titles', {
        data: {
          entries: [
            { sourceFilename: filename, titles: [`Numele adevărat ${marker}`] },
          ],
        },
      })
      expect((await again.json()).data).toEqual({ matched: 1, updated: 0 })
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('the endpoint refuses a batch larger than it will commit at once', async ({
    request,
  }) => {
    const response = await request.post('/api/songs/alternate-titles', {
      data: {
        entries: Array.from({ length: 501 }, (_, index) => ({
          sourceFilename: `f${index}.xml`,
          titles: ['x'],
        })),
      },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toContain('Too many')
  })
})
