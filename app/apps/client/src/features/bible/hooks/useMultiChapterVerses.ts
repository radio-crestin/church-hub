import { useQuery } from '@tanstack/react-query'

import { getChapters } from '../service'
import type { BibleVerse } from '../types'

export interface ChapterVerses {
  chapter: number
  verses: BibleVerse[]
}

/**
 * Hook to get the chapter count for a book
 */
export function useChapterCount(bookId: number | undefined) {
  const { data: chapters = [] } = useQuery({
    queryKey: ['bible', 'chapters', bookId],
    queryFn: () => getChapters(bookId!),
    enabled: !!bookId,
    staleTime: 10 * 60 * 1000,
  })

  return chapters.length
}
