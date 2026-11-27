import { BUILT_IN_SONG_SOURCES } from './builtInSongSources'
import { getFeaturedList, toFeaturedSongSources } from './featured'
import { listLinkSources } from './links/listLinkSources'
import type { SongSource } from './types'

/**
 * Every song source the app can import from: the ones Church Hub offers
 * (its featured list, read from the cloud or shipped with the installer;
 * the app's built-in list for any it does not name), then added links.
 */
export function listSongSources(): SongSource[] {
  const list = getFeaturedList()
  const featured = list ? toFeaturedSongSources(list) : []
  const named = new Set(featured.map((source) => source.id))
  return [
    ...featured,
    ...BUILT_IN_SONG_SOURCES.filter((source) => !named.has(source.id)),
    ...listLinkSources(),
  ]
}

/** A source by id; throws when there is none. */
export function findSongSource(sourceId: string): SongSource {
  const source = listSongSources().find((s) => s.id === sourceId)
  if (!source) throw new Error(`Unknown song source: ${sourceId}`)
  return source
}
