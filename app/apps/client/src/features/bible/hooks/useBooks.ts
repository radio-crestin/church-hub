import { useQuery } from '@tanstack/react-query'

import { getBooks } from '../service'

export function useBooks(translationId: number | undefined) {
  return useQuery({
    queryKey: ['bible', 'books', translationId],
    queryFn: () => getBooks(translationId!),
    enabled: !!translationId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}
