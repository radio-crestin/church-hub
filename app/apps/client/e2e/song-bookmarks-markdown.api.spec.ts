import { expect, test } from '@playwright/test'

/**
 * The song Marcaje export is standard Markdown that names every song by its
 * id, so an import finds the exact song even when two share a title.
 *
 * Serial: it writes to the one global song bookmark list.
 */
test.describe('Song bookmarks as Markdown', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ request }) => {
    await request.delete('/api/song-bookmarks')
  })

  test.afterAll(async ({ request }) => {
    await request.delete('/api/song-bookmarks')
  })

  test('the export carries the song id, the note and the lyrics', async ({
    request,
  }) => {
    const songs = (await (await request.get('/api/songs?limit=1')).json()).data
      .songs as Array<{ id: number; title: string }>
    const song = songs[0]
    expect(song, 'a seeded song exists').toBeTruthy()

    await request.post('/api/song-bookmarks', { data: { songId: song.id } })
    await request.post('/api/song-bookmark-notes', {
      data: { content: 'Final' },
    })

    const exported = (
      await (await request.get('/api/song-bookmarks/export')).json()
    ).data as string

    const heading = exported.split('\n')[0]
    expect(heading.startsWith('## ')).toBe(true)
    expect(heading.endsWith(`{#song-${song.id}}`)).toBe(true)
    expect(exported).toContain('\n> Final\n')
    // Lyrics come out as text, not as the stored slide HTML
    expect(exported).not.toContain('<p>')
  })
})
