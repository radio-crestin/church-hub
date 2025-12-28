import { useQuery } from '@tanstack/react-query'

import { searchSongs } from '../service'
import type { SongSearchResult } from '../types'

export function useSearchSongs(query: string) {
  return useQuery<SongSearchResult[]>({
    queryKey: ['songs', 'search', query],
    queryFn: ({ signal }) => searchSongs(query, signal),
    enabled: query.length > 0,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}
