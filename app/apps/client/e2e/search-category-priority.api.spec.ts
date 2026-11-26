import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * A category's priority only orders equally good matches.
 *
 * Reordering categories numbers them N..1, so a church with a dozen categories
 * gives its first one priority 12. Used as a score multiplier, that let a song
 * in the first category which only shares a few of the typed words outrank
 * the one song holding the exact phrase, and pushed it off the result list.
 */

async function createCategory(request: APIRequestContext, priority: number) {
  const response = await request.post('/api/categories', {
    data: { name: `E2E Priority ${Date.now()}`, priority },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number }
}

async function createSong(
  request: APIRequestContext,
  song: { title: string; line: string; categoryId?: number },
) {
  const response = await request.post('/api/songs', {
    data: {
      title: song.title,
      categoryId: song.categoryId ?? null,
      slides: [{ content: song.line, sortOrder: 0 }],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

test('the song with the exact phrase ranks above a partial match in a higher-priority category', async ({
  request,
}) => {
  const marker = `qzprio${Date.now()}`
  const category = await createCategory(request, 20)
  const partial = await createSong(request, {
    title: `Alt cântec ${marker}`,
    line: `Lumina vine iar ${marker} peste ape`,
    categoryId: category.id,
  })
  const exact = await createSong(request, {
    title: `Un cântec ${marker}`,
    line: `Peste cerul senin răsare lumina ${marker}`,
  })
  try {
    const response = await request.get(
      `/api/songs/search?q=${encodeURIComponent(`cerul senin răsare lumina ${marker}`)}`,
    )
    const ids = ((await response.json()).data as Array<{ id: number }>).map(
      (r) => r.id,
    )
    const exactAt = ids.indexOf(exact.id)
    const partialAt = ids.indexOf(partial.id)
    expect(exactAt).toBeGreaterThanOrEqual(0)
    // The partial match may rank anywhere below, or drop off the list.
    expect(partialAt === -1 || exactAt < partialAt).toBe(true)
  } finally {
    await request.delete(`/api/songs/${partial.id}`)
    await request.delete(`/api/songs/${exact.id}`)
    await request.delete(`/api/categories/${category.id}`)
  }
})
