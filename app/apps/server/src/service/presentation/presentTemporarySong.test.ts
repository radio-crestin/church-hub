import type { PresentationState, TemporarySongContent } from './types'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createMigratedTestDatabase } from '../../__tests__/helpers/createMigratedTestDatabase'

type PresentationModule = typeof import('./presentation-state')
type SongsModule = typeof import('../songs/songs')

const VIDEO_BACKGROUND = {
  type: 'video' as const,
  videoUrl: '/api/media/backgrounds/7c9e6679-7425-40de-944b-e07fc1f90ae7.mp4',
  opacity: 0.9,
}
const COLOR_BACKGROUND = {
  type: 'color' as const,
  color: '#223344',
  opacity: 0.5,
}

let presentation: PresentationModule
let songsService: SongsModule

function songData(state: PresentationState | null): TemporarySongContent {
  if (state?.temporaryContent?.type !== 'song') {
    throw new Error('Expected a temporary song to be presented')
  }
  return state.temporaryContent.data
}

function createSong(title: string, extra: object = {}): number {
  const song = songsService.upsertSong({
    title,
    slides: [
      { content: 'Verse one', sortOrder: 0, label: 'V1' },
      { content: 'Verse two', sortOrder: 1, label: 'V2' },
    ],
    ...extra,
  })
  if (!song) throw new Error(`Failed to create song ${title}`)
  return song.id
}

beforeAll(async () => {
  await createMigratedTestDatabase()
  presentation = await import('./presentation-state')
  songsService = await import('../songs/songs')
})

describe('temporary song background', () => {
  test('presentTemporarySong carries the song background', () => {
    const songId = createSong('Presented with background', {
      background: VIDEO_BACKGROUND,
    })
    const state = presentation.presentTemporarySong({ songId })
    expect(songData(state).songId).toBe(songId)
    expect(songData(state).background).toEqual(VIDEO_BACKGROUND)
  })

  test('a song without an override presents a null background', () => {
    const songId = createSong('Presented without background')
    const state = presentation.presentTemporarySong({ songId })
    expect(songData(state).songId).toBe(songId)
    expect(songData(state).background).toBeNull()
  })

  test('navigating between slides keeps the background', () => {
    const songId = createSong('Navigated with background', {
      background: VIDEO_BACKGROUND,
    })
    presentation.presentTemporarySong({ songId })
    const state = presentation.navigateTemporary('next', Date.now())
    expect(songData(state).currentSlideIndex).toBe(1)
    expect(songData(state).background).toEqual(VIDEO_BACKGROUND)
  })

  test('saving the live song refreshes, replaces and clears its background', () => {
    const songId = createSong('Edited while live', {
      background: VIDEO_BACKGROUND,
    })
    presentation.presentTemporarySong({ songId })

    songsService.upsertSong({
      id: songId,
      title: 'Edited while live',
      background: COLOR_BACKGROUND,
    })
    const replaced = presentation.refreshPresentedSongSlides(songId)
    expect(songData(replaced).background).toEqual(COLOR_BACKGROUND)
    expect(songData(presentation.getPresentationState()).background).toEqual(
      COLOR_BACKGROUND,
    )

    songsService.upsertSong({
      id: songId,
      title: 'Edited while live',
      background: null,
    })
    const cleared = presentation.refreshPresentedSongSlides(songId)
    expect(songData(cleared).background).toBeNull()
  })
})
