import { useQuery } from '@tanstack/react-query'

import { getSongHistory } from '../service/songHistory'

export const songHistoryQueryKey = (songId: number) =>
  ['song-history', songId] as const

/** The song's edit history, newest first. Only loads while `enabled`. */
export function useSongHistory(songId: number, enabled: boolean) {
  return useQuery({
    queryKey: songHistoryQueryKey(songId),
    queryFn: () => getSongHistory(songId),
    enabled,
    // History must be fresh every time the dialog opens.
    staleTime: 0,
  })
}
