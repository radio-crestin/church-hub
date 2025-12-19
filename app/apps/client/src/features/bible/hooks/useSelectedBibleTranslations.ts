import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getSelectedBibleTranslationIds,
  saveSelectedBibleTranslationIds,
} from '~/service/bible'
import { useTranslations } from './useTranslations'
import type { BibleTranslation } from '../types'

export const SELECTED_BIBLE_TRANSLATIONS_QUERY_KEY = [
  'settings',
  'selected_bible_translations',
]

export const MAX_TRANSLATIONS = 3

export function useSelectedBibleTranslations() {
  const queryClient = useQueryClient()
  const { data: translations = [], isLoading: isTranslationsLoading } =
    useTranslations()

  const { data: selectedIds = [], isLoading: isSettingLoading } = useQuery({
    queryKey: SELECTED_BIBLE_TRANSLATIONS_QUERY_KEY,
    queryFn: getSelectedBibleTranslationIds,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const saveTranslations = useMutation({
    mutationFn: saveSelectedBibleTranslationIds,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: SELECTED_BIBLE_TRANSLATIONS_QUERY_KEY,
      })
    },
  })

  // Filter and order translations based on selectedIds
  const selectedTranslations: BibleTranslation[] = selectedIds
    .map((id) => translations.find((t) => t.id === id))
    .filter((t): t is BibleTranslation => t !== undefined)

  // Get available translations (not yet selected)
  const availableTranslations: BibleTranslation[] = translations.filter(
    (t) => !selectedIds.includes(t.id),
  )

  // Primary translation is the first one in the list
  const primaryTranslation: BibleTranslation | null =
    selectedTranslations[0] ?? null

  const isLoading = isTranslationsLoading || isSettingLoading
  const canAddMore = selectedIds.length < MAX_TRANSLATIONS

  const addTranslation = async (translationId: number) => {
    if (!canAddMore) return
    const newIds = [...selectedIds, translationId]
    await saveTranslations.mutateAsync(newIds)
  }

  const removeTranslation = async (translationId: number) => {
    const newIds = selectedIds.filter((id) => id !== translationId)
    await saveTranslations.mutateAsync(newIds)
  }

  const reorderTranslations = async (newOrder: number[]) => {
    await saveTranslations.mutateAsync(newOrder)
  }

  return {
    selectedTranslations,
    selectedIds,
    availableTranslations,
    translations,
    primaryTranslation,
    addTranslation,
    removeTranslation,
    reorderTranslations,
    saveTranslations,
    isLoading,
    canAddMore,
    maxTranslations: MAX_TRANSLATIONS,
  }
}
