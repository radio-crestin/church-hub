import { useQuery } from '@tanstack/react-query'

import { getGroupForSong } from '../service'
import type { SongGroup } from '../types'

/**
 * Loads the song group a given song belongs to. Returns `null` (not an
 * error) when the song is standalone — the UI uses that to decide whether
 * to render the "Other versions" panel.
 */
export function useSongGroup(songId: number | null) {
  return useQuery<SongGroup | null>({
    queryKey: ['song-group', songId],
    queryFn: () => getGroupForSong(songId!),
    enabled: songId !== null,
  })
}
