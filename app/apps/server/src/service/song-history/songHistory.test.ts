import { beforeAll, describe, expect, test } from 'bun:test'
import { createMigratedTestDatabase } from '../../__tests__/helpers/createMigratedTestDatabase'

type HistoryModule = typeof import('./index')
type SongsModule = typeof import('../songs/songs')

const ANA = { userId: 1, name: 'Ana' }
const BOB = { userId: 2, name: 'Bob' }

let history: HistoryModule
let songs: SongsModule

function slide(content: string, sortOrder: number) {
  return { content, sortOrder, label: `V${sortOrder + 1}` }
}

function createSong(title: string) {
  const song = history.saveSongWithHistory(
    { title, slides: [slide('first verse', 0), slide('second verse', 1)] },
    ANA,
  )
  if (!song) throw new Error('song not created')
  return song
}

beforeAll(async () => {
  await createMigratedTestDatabase()
  history = await import('./index')
  songs = await import('../songs/songs')
})

describe('saving a song', () => {
  test('a new song gets a "created" entry with no before', () => {
    const song = createSong('Created song')
    const [entry] = history.listSongHistory(song.id)
    expect(entry?.kind).toBe('created')
    expect(entry?.editedByName).toBe('Ana')
    expect(entry?.titleBefore).toBeNull()
    expect(entry?.titleAfter).toBe('Created song')
  })

  test('an edit records who, and the title and slides before and after', () => {
    const song = createSong('Before title')
    history.saveSongWithHistory(
      {
        id: song.id,
        title: 'After title',
        slides: [slide('first verse', 0), slide('changed verse', 1)],
      },
      BOB,
    )

    const [latest] = history.listSongHistory(song.id)
    expect(latest?.kind).toBe('edited')
    expect(latest?.editedByName).toBe('Bob')
    expect(latest?.changes).toEqual({
      titleChanged: true,
      slidesAdded: 0,
      slidesRemoved: 0,
      slidesChanged: 1,
    })

    const detail = history.getSongHistoryEntry(song.id, latest!.id)
    expect(detail?.before?.title).toBe('Before title')
    expect(detail?.after.title).toBe('After title')
    expect(detail?.before?.slides[1]?.content).toBe('second verse')
    expect(detail?.after.slides[1]?.content).toBe('changed verse')
  })

  test('a save that changes neither title nor slides leaves no entry', () => {
    const song = createSong('Key only')
    history.saveSongWithHistory(
      { id: song.id, title: 'Key only', keyLine: 'G' },
      ANA,
    )
    expect(history.listSongHistory(song.id)).toHaveLength(1)
  })

  test('the list is newest first', () => {
    const song = createSong('Order')
    history.saveSongWithHistory({ id: song.id, title: 'Order 2' }, ANA)
    history.saveSongWithHistory({ id: song.id, title: 'Order 3' }, ANA)
    const titles = history.listSongHistory(song.id).map((e) => e.titleAfter)
    expect(titles).toEqual(['Order 3', 'Order 2', 'Order'])
  })
})

describe('restoring a version', () => {
  test('puts the title and slides back and records a restore entry', () => {
    const song = createSong('Original')
    history.saveSongWithHistory(
      { id: song.id, title: 'Edited', slides: [slide('only verse', 0)] },
      ANA,
    )
    const [edit] = history.listSongHistory(song.id)

    const restored = history.restoreSongVersion(
      song.id,
      edit!.id,
      'before',
      BOB,
    )

    expect(restored?.title).toBe('Original')
    expect(restored?.slides.map((s) => s.content)).toEqual([
      'first verse',
      'second verse',
    ])
    const [latest] = history.listSongHistory(song.id)
    expect(latest?.kind).toBe('restored')
    expect(latest?.editedByName).toBe('Bob')
    expect(latest?.restoredFromId).toBe(edit!.id)
  })

  test('a created entry has no before to restore', () => {
    const song = createSong('No before')
    const [created] = history.listSongHistory(song.id)
    expect(
      history.restoreSongVersion(song.id, created!.id, 'before', ANA),
    ).toBeNull()
  })

  test('an entry of another song cannot be restored', () => {
    const a = createSong('Song A')
    const b = createSong('Song B')
    const [entryOfA] = history.listSongHistory(a.id)
    expect(
      history.restoreSongVersion(b.id, entryOfA!.id, 'after', ANA),
    ).toBeNull()
  })
})

describe('deleting a song', () => {
  test('removes its history', () => {
    const song = createSong('Doomed')
    songs.deleteSong(song.id)
    expect(history.listSongHistory(song.id)).toEqual([])
  })
})
