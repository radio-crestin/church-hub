import { useQuery } from '@tanstack/react-query'

import { getTranslations } from '../service'

export const TRANSLATIONS_QUERY_KEY = ['bible', 'translations']

export function useTranslations() {
  return useQuery({
    queryKey: TRANSLATIONS_QUERY_KEY,
    queryFn: getTranslations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
