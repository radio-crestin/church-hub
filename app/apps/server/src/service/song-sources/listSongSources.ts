import { BUILT_IN_SONG_SOURCES } from './builtInSongSources'
import { listLinkSources } from './links/listLinkSources'
import type { SongSource } from './types'

/** Every song source the app can import from: built-in, then added links. */
export function listSongSources(): SongSource[] {
  return [...BUILT_IN_SONG_SOURCES, ...listLinkSources()]
}
