import { useQueries } from '@tanstack/react-query'

import type { SongSource } from '../providers'
import { type ChangedSong, getChangedSongs } from '../service/songSourcesApi'

export const CHANGED_SONGS_QUERY_KEY = 'song-source-changed'

/** A library song a source changed, and which source. */
export interface ChangedEntry extends ChangedSong {
  /** `<sourceId>:<songId>`, unique across sources. */
  key: string
  sourceId: string
}

/**
 * The library songs the given sources changed, waiting for the user's
 * choice (syncing without approval off). Read again when the server
 * finishes a new check (`checkedAt`). Opened files change nothing.
 */
export function useChangedSongs(
  sources: SongSource[],
  checkedAt: number | null,
): ChangedEntry[] {
  return useQueries({
    queries: sources
      .filter((source) => source.origin !== 'file')
      .map((source) => ({
        queryKey: [CHANGED_SONGS_QUERY_KEY, source.id, checkedAt],
        queryFn: async (): Promise<ChangedEntry[]> =>
          (await getChangedSongs(source.id)).map((changed) => ({
            ...changed,
            key: `${source.id}:${changed.songId}`,
            sourceId: source.id,
          })),
        staleTime: Number.POSITIVE_INFINITY,
      })),
    combine: (results) => results.flatMap((result) => result.data ?? []),
  })
}
