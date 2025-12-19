import { useQueries } from '@tanstack/react-query'

import { getVerseByReference } from '../service'
import type { BibleTranslation, BibleVerse } from '../types'

export interface MultiTranslationVerseResult {
  translation: BibleTranslation
  verse: BibleVerse | null
  isLoading: boolean
  isError: boolean
}

export function useMultiTranslationVerse(
  translations: BibleTranslation[],
  bookCode: string | undefined,
  chapter: number | undefined,
  verseNumber: number | undefined,
) {
  const enabled = !!bookCode && !!chapter && !!verseNumber

  const queries = useQueries({
    queries: translations.map((translation) => ({
      queryKey: [
        'bible',
        'verse-by-reference',
        translation.id,
        bookCode,
        chapter,
        verseNumber,
      ],
      queryFn: () =>
        getVerseByReference(translation.id, bookCode!, chapter!, verseNumber!),
      enabled,
      staleTime: 10 * 60 * 1000, // 10 minutes
    })),
  })

  const results: MultiTranslationVerseResult[] = translations.map(
    (translation, index) => ({
      translation,
      verse: queries[index]?.data ?? null,
      isLoading: queries[index]?.isLoading ?? false,
      isError: queries[index]?.isError ?? false,
    }),
  )

  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)

  return {
    results,
    isLoading,
    isError,
  }
}
