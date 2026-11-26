import { useQuery } from '@tanstack/react-query'

import { isWebApp } from '~/config'
import type { SongSource } from '../providers'
import { getSongSources } from '../service/songSourcesApi'

export const SONG_SOURCES_QUERY_KEY = ['song-sources'] as const

/**
 * Every song source the app can import from, built-in first. The web app
 * has none (they are the church PC's), only the song files it opens.
 */
export function useSongSources(enabled = true) {
  return useQuery<SongSource[]>({
    queryKey: SONG_SOURCES_QUERY_KEY,
    queryFn: getSongSources,
    staleTime: 1000 * 60 * 5,
    enabled: enabled && !isWebApp,
  })
}
