import { useQuery } from '@tanstack/react-query'

import { searchBible } from '../service'

export function useSearchBible(
  query: string,
  translationId?: number,
  limit?: number,
  enabled = true,
) {
  return useQuery({
    queryKey: ['bible', 'search', query, translationId, limit],
    queryFn: () => searchBible(query, translationId, limit),
    enabled: enabled && query.length >= 2,
    staleTime: 60 * 1000, // 1 minute
  })
}
