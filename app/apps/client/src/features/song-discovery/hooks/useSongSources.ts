import { useQuery } from '@tanstack/react-query'

import type { SongSource } from '../providers'
import { getSongSources } from '../service/songSourcesApi'

export const SONG_SOURCES_QUERY_KEY = ['song-sources'] as const

/** Every song source the app can import from, built-in first. */
export function useSongSources() {
  return useQuery<SongSource[]>({
    queryKey: SONG_SOURCES_QUERY_KEY,
    queryFn: getSongSources,
    staleTime: 1000 * 60 * 5,
  })
}
