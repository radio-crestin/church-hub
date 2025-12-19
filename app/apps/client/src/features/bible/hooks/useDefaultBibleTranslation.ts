import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getDefaultBibleTranslationId,
  saveDefaultBibleTranslationId,
} from '~/service/bible'
import { useTranslations } from './useTranslations'
import type { BibleTranslation } from '../types'

export const DEFAULT_BIBLE_TRANSLATION_QUERY_KEY = [
  'settings',
  'default_bible_translation',
]

export function useDefaultBibleTranslation() {
  const queryClient = useQueryClient()
  const { data: translations = [], isLoading: isTranslationsLoading } =
    useTranslations()

  const { data: defaultTranslationId, isLoading: isSettingLoading } = useQuery({
    queryKey: DEFAULT_BIBLE_TRANSLATION_QUERY_KEY,
    queryFn: getDefaultBibleTranslationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const setDefaultTranslation = useMutation({
    mutationFn: saveDefaultBibleTranslationId,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: DEFAULT_BIBLE_TRANSLATION_QUERY_KEY,
      })
    },
  })

  // Find the translation object from the ID
  // If no default is set, use the first available translation
  const translation: BibleTranslation | null =
    translations.find((t) => t.id === defaultTranslationId) ??
    translations[0] ??
    null

  const isLoading = isTranslationsLoading || isSettingLoading

  return {
    translation,
    translations,
    defaultTranslationId,
    setDefaultTranslation,
    isLoading,
  }
}
