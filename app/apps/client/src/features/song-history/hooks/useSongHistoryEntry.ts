import { useQuery } from '@tanstack/react-query'

import { getSongHistoryEntry } from '../service/songHistory'

/** One entry with its before/after snapshots; loads only once expanded. */
export function useSongHistoryEntry(
  songId: number,
  entryId: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['song-history', songId, entryId],
    queryFn: () => getSongHistoryEntry(songId, entryId),
    enabled,
    // Entries never change once written.
    staleTime: Infinity,
  })
}
