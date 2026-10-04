import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Song Marcaje edited as text, in the same Markdown the export writes.
 *
 * Serial: every test rewrites the one global song bookmark list.
 */
test.describe('Song Marcaje as text', () => {
  test.describe.configure({ mode: 'serial' })

  const created: Array<{ id: number; title: string }> = []

  async function createSong(request: APIRequestContext, title: string) {
    const response = await request.post('/api/songs', {
      data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
    })
    expect(response.status()).toBe(201)
    const song = (await response.json()).data as { id: number; title: string }
    created.push(song)
    return song
  }

  async function listOrder(request: APIRequestContext) {
    const bookmarks = (await (await request.get('/api/song-bookmarks')).json())
      .data as Array<{ songId: number; sortOrder: number; isSung: boolean }>
    const notes = (await (await request.get('/api/song-bookmark-notes')).json())
      .data as Array<{ content: string; sortOrder: number }>
    return [
      ...bookmarks.map((b) => ({ sortOrder: b.sortOrder, item: b.songId })),
      ...notes.map((n) => ({ sortOrder: n.sortOrder, item: n.content })),
    ]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((entry) => entry.item)
  }

  test.beforeEach(async ({ request }) => {
    await request.delete('/api/song-bookmarks')
  })

  test.afterAll(async ({ request }) => {
    await request.delete('/api/song-bookmarks')
    for (const song of created) await request.delete(`/api/songs/${song.id}`)
  })

  test('the editor shows the list as Markdown and saves what is typed', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const first = await createSong(request, `E2E Text First ${uniq}`)
    const second = await createSong(request, `E2E Text Second ${uniq}`)
    const typed = await createSong(request, `E2E Ţext Typed ${uniq}`)
    await request.post('/api/song-bookmarks', { data: { songId: first.id } })
    await request.post('/api/song-bookmarks', { data: { songId: second.id } })

    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/songs/${first.id}`)
    await expect(page.getByTestId('bookmark-item')).toHaveCount(2, {
      timeout: 15000,
    })

    await page.getByTestId('bookmarks-edit-text').click()
    const textarea = page.getByTestId('bookmarks-text-textarea')
    await expect(textarea).toHaveValue(
      `## E2E Text First ${uniq} {#song-${first.id}}\n## E2E Text Second ${uniq} {#song-${second.id}}\n`,
    )

    // A note, then a song by its title typed without the diacritic.
    await textarea.fill(
      `## E2E Text Second ${uniq} {#song-${second.id}}\n> Final\ne2e text typed ${uniq}\n`,
    )
    await page.getByTestId('bookmarks-text-save').click()

    await expect(page.getByTestId('bookmarks-text-modal')).toBeHidden()
    await expect(page.getByTestId('bookmark-item')).toHaveCount(2)
    expect(await listOrder(request)).toEqual([second.id, 'Final', typed.id])
  })

  test('an unknown song saves nothing and is pointed out by line', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Text Kept ${Date.now()}`)
    await request.post('/api/song-bookmarks', { data: { songId: song.id } })

    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/songs/${song.id}`)
    await page.getByTestId('bookmarks-edit-text').click()
    const textarea = page.getByTestId('bookmarks-text-textarea')
    await expect(textarea).not.toHaveValue('')
    await textarea.fill('> Intro\nNo Such Song Anywhere 123')
    await page.getByTestId('bookmarks-text-save').click()

    const errors = page.getByTestId('bookmarks-text-errors')
    await expect(errors).toContainText('2')
    await expect(errors).toContainText('No Such Song Anywhere 123')
    expect(await listOrder(request)).toEqual([song.id])
  })

  test('a song kept in the list keeps its sung mark', async ({ request }) => {
    const uniq = Date.now()
    const a = await createSong(request, `E2E Sung A ${uniq}`)
    const b = await createSong(request, `E2E Sung B ${uniq}`)
    await request.post('/api/song-bookmarks', { data: { songId: a.id } })
    await request.post('/api/song-bookmarks', { data: { songId: b.id } })
    const rows = (await (await request.get('/api/song-bookmarks')).json()).data
    await request.put(`/api/song-bookmarks/${rows[0].id}/sung`, {
      data: { isSung: true },
    })

    const result = await (
      await request.put('/api/song-bookmarks/text', {
        data: { text: `## B {#song-${b.id}}\n## A {#song-${a.id}}` },
      })
    ).json()
    expect(result.data).toMatchObject({ applied: true, songs: 2, errors: [] })

    const after = (await (await request.get('/api/song-bookmarks')).json())
      .data as Array<{ songId: number; isSung: boolean }>
    expect(after.map((row) => [row.songId, row.isSung])).toEqual([
      [b.id, false],
      [a.id, true],
    ])
  })

  test('the full export reads back to the same list', async ({ request }) => {
    const uniq = Date.now()
    const a = await createSong(request, `E2E Export A ${uniq}`)
    const b = await createSong(request, `E2E Export B ${uniq}`)
    await request.post('/api/song-bookmarks', { data: { songId: a.id } })
    await request.post('/api/song-bookmark-notes', { data: { content: 'Mid' } })
    await request.post('/api/song-bookmarks', { data: { songId: b.id } })
    const before = await listOrder(request)

    const exported = (
      await (await request.get('/api/song-bookmarks/export')).json()
    ).data
    await request.delete('/api/song-bookmarks')
    const result = await (
      await request.put('/api/song-bookmarks/text', {
        data: { text: exported },
      })
    ).json()

    expect(result.data.errors).toEqual([])
    expect(await listOrder(request)).toEqual(before)
  })
})
