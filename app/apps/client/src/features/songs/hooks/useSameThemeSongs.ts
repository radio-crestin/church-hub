import { useQuery } from '@tanstack/react-query'

import { getSameThemeSongs } from '../service'
import type { SameThemeSong } from '../types'

/** The songs on the same theme as `songId`, cached a few minutes per song. */
export function useSameThemeSongs(songId: number, enabled = true) {
  return useQuery<SameThemeSong[]>({
    queryKey: ['song-same-theme', songId],
    queryFn: () => getSameThemeSongs(songId),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
