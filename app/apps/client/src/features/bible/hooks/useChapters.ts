import { useQuery } from '@tanstack/react-query'

import { getChapters } from '../service'

export function useChapters(bookId: number | undefined) {
  return useQuery({
    queryKey: ['bible', 'chapters', bookId],
    queryFn: () => getChapters(bookId!),
    enabled: !!bookId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}
