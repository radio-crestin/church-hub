import { useQuery } from '@tanstack/react-query'

import { getSameThemeSongs } from '../service'
import type { SongThemeSuggestion } from '../types'

/** The songs on the same theme as `songId`; cached a while, as the library rarely changes under it. */
export function useSameThemeSongs(songId: number, enabled = true) {
  return useQuery<SongThemeSuggestion[]>({
    queryKey: ['song-same-theme', songId],
    queryFn: () => getSameThemeSongs(songId),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
