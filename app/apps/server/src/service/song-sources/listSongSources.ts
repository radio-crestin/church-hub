import { BUILT_IN_SONG_SOURCES } from './builtInSongSources'
import { listLinkSources } from './links/listLinkSources'
import type { SongSource } from './types'

/** Every song source the app can import from: built-in, then added links. */
export function listSongSources(): SongSource[] {
  return [...BUILT_IN_SONG_SOURCES, ...listLinkSources()]
}

/** A source by id; throws when there is none. */
export function findSongSource(sourceId: string): SongSource {
  const source = listSongSources().find((s) => s.id === sourceId)
  if (!source) throw new Error(`Unknown song source: ${sourceId}`)
  return source
}
