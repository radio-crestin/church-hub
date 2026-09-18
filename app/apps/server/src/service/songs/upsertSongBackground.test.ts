import type { Database } from 'bun:sqlite'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createMigratedTestDatabase } from '../../__tests__/helpers/createMigratedTestDatabase'

type SongsModule = typeof import('./songs')

const IMAGE_BACKGROUND = {
  type: 'image' as const,
  imageUrl: '/api/media/backgrounds/0f8fad5b-d9cb-469f-a165-70867728950e.png',
  opacity: 0.6,
}
const COLOR_BACKGROUND = {
  type: 'color' as const,
  color: '#102030',
  opacity: 1,
}

let sqlite: Database
let songsService: SongsModule

function createSong(title: string, extra: object = {}) {
  const song = songsService.upsertSong({
    title,
    slides: [{ content: 'Line one', sortOrder: 0, label: 'V1' }],
    ...extra,
  })
  if (!song) throw new Error(`Failed to create song ${title}`)
  return song
}

beforeAll(async () => {
  ;({ sqlite } = await createMigratedTestDatabase())
  songsService = await import('./songs')
})

describe('songs.background column', () => {
  test('a fresh database gets the column through the migration steps', () => {
    const columns = sqlite
      .query<{ name: string }, []>('PRAGMA table_info(songs)')
      .all()
      .map((col) => col.name)
    expect(columns).toContain('background')
  })
})

describe('upsertSong background', () => {
  test('create stores the background and reads it back', () => {
    const song = createSong('Background on create', {
      background: IMAGE_BACKGROUND,
    })
    expect(song.background).toEqual(IMAGE_BACKGROUND)
    expect(songsService.getSongById(song.id)?.background).toEqual(
      IMAGE_BACKGROUND,
    )
  })

  test('create without a background stores null', () => {
    const song = createSong('No background')
    expect(song.background).toBeNull()
    const raw = sqlite
      .query<{ background: string | null }, [number]>(
        'SELECT background FROM songs WHERE id = ?',
      )
      .get(song.id)
    expect(raw?.background).toBeNull()
  })

  test('update without the field leaves the background unchanged', () => {
    const song = createSong('Unchanged background', {
      background: COLOR_BACKGROUND,
    })
    const updated = songsService.upsertSong({
      id: song.id,
      title: 'Unchanged background (renamed)',
    })
    expect(updated?.title).toBe('Unchanged background (renamed)')
    expect(updated?.background).toEqual(COLOR_BACKGROUND)
  })

  test('update with an object replaces the background', () => {
    const song = createSong('Replaced background', {
      background: COLOR_BACKGROUND,
    })
    const updated = songsService.upsertSong({
      id: song.id,
      title: song.title,
      background: IMAGE_BACKGROUND,
    })
    expect(updated?.background).toEqual(IMAGE_BACKGROUND)
  })

  test('update with null clears the background', () => {
    const song = createSong('Cleared background', {
      background: IMAGE_BACKGROUND,
    })
    const updated = songsService.upsertSong({
      id: song.id,
      title: song.title,
      background: null,
    })
    expect(updated?.background).toBeNull()
  })

  test('stray keys on the input are not stored', () => {
    const song = createSong('Stray keys', {
      background: { ...COLOR_BACKGROUND, extra: 'dropped' },
    })
    expect(song.background).toEqual(COLOR_BACKGROUND)
  })

  test('the paginated list and the export include the background', async () => {
    // A category of its own keeps both reads off the large seeded library.
    const { upsertCategory } = await import('./categories')
    const category = upsertCategory({ name: 'Background test category' })
    if (!category) throw new Error('Failed to create category')
    const listed = createSong('Listed background', {
      categoryId: category.id,
      background: IMAGE_BACKGROUND,
    })
    const plain = createSong('Listed without background', {
      categoryId: category.id,
    })

    const page = songsService.getSongsPaginated(10, 0, {
      categoryIds: [category.id],
    })
    expect(page.songs.find((s) => s.id === listed.id)?.background).toEqual(
      IMAGE_BACKGROUND,
    )
    expect(page.songs.find((s) => s.id === plain.id)?.background).toBeNull()

    const exported = songsService.getAllSongsWithSlides(category.id)
    expect(exported.find((s) => s.id === listed.id)?.background).toEqual(
      IMAGE_BACKGROUND,
    )
    expect(exported.find((s) => s.id === plain.id)?.background).toBeNull()
  })

  test('malformed stored JSON reads as no background', () => {
    const song = createSong('Corrupt background')
    sqlite.run('UPDATE songs SET background = ? WHERE id = ?', [
      '{broken',
      song.id,
    ])
    expect(songsService.getSongById(song.id)?.background).toBeNull()
  })
})
