import { useQuery } from '@tanstack/react-query'

import { getVerseById, getVerses } from '../service'

export function useVerses(
  bookId: number | undefined,
  chapter: number | undefined,
) {
  return useQuery({
    queryKey: ['bible', 'verses', bookId, chapter],
    queryFn: () => getVerses(bookId!, chapter!),
    enabled: !!bookId && !!chapter,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useVerse(verseId: number | undefined) {
  return useQuery({
    queryKey: ['bible', 'verse', verseId],
    queryFn: () => getVerseById(verseId!),
    enabled: !!verseId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}
