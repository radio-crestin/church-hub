import { useQuery } from '@tanstack/react-query'

import { searchSongs } from '../service'
import type { SongSearchResult } from '../types'

export function useSearchSongs(
  query: string,
  categoryIds?: number[],
  filters?: {
    presentedOnly?: boolean
    inSchedulesOnly?: boolean
    hasKeyLine?: boolean
  },
) {
  return useQuery<SongSearchResult[]>({
    queryKey: ['songs', 'search', query, categoryIds, filters],
    queryFn: ({ signal }) => searchSongs(query, categoryIds, signal, filters),
    enabled: query.length > 0,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}
