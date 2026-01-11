import { useQuery } from '@tanstack/react-query'

import { searchSongs } from '../service'
import type { SongSearchResult } from '../types'

export function useSearchSongs(query: string, categoryIds?: number[]) {
  return useQuery<SongSearchResult[]>({
    queryKey: ['songs', 'search', query, categoryIds],
    queryFn: ({ signal }) => searchSongs(query, categoryIds, signal),
    enabled: query.length > 0,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}
