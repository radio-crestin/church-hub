import { BUILT_IN_SONG_SOURCES } from './builtInSongSources'
import type { SongSource } from './types'

/** Every song source the app can import from, built-in first. */
export function listSongSources(): SongSource[] {
  return BUILT_IN_SONG_SOURCES
}
