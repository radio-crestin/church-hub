import { useQuery } from '@tanstack/react-query'

import { searchSongs } from '../service'
import type { SongSearchResult } from '../types'

export function useSearchSongs(query: string) {
  return useQuery<SongSearchResult[]>({
    queryKey: ['songs', 'search', query],
    queryFn: () => searchSongs(query),
    enabled: query.length > 0,
  })
}
