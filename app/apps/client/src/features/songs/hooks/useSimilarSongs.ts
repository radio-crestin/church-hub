import { useQuery } from '@tanstack/react-query'

import { getSimilarSongs } from '../service'
import type { SongVersionSuggestion } from '../types'

/**
 * Asks the server which songs look like versions of `songId`. Returns an
 * empty list (not an error) when nothing scores high enough — the UI uses
 * that to decide whether to render the "Sugestii" section at all.
 *
 * Cached for a short while so opening a song / coming back doesn't re-run
 * the FTS for nothing.
 */
export function useSimilarSongs(songId: number | null, limit = 5) {
  return useQuery<SongVersionSuggestion[]>({
    queryKey: ['song-similar', songId, limit],
    queryFn: () => getSimilarSongs(songId!, limit),
    enabled: songId !== null,
    staleTime: 5 * 60 * 1000,
  })
}
