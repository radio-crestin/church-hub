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

export const MAX_TRANSLATIONS = 2

export function useSelectedBibleTranslations() {
  const queryClient = useQueryClient()
  const { data: translations = [], isLoading: isTranslationsLoading } =
    useTranslations()

  const { data: selectedIds = [], isLoading: isSettingLoading } = useQuery({
    queryKey: SELECTED_BIBLE_TRANSLATIONS_QUERY_KEY,
    queryFn: getSelectedBibleTranslationIds,
    staleTime: 0, // Always fetch fresh data - translation changes need to be immediate
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

  // Secondary translation is the second one (if exists)
  const secondaryTranslation: BibleTranslation | null =
    selectedTranslations[1] ?? null

  const isLoading = isTranslationsLoading || isSettingLoading
  const canAddMore = selectedIds.length < MAX_TRANSLATIONS

  // Set primary translation (replaces first slot)
  const setPrimaryTranslation = async (translationId: number | null) => {
    if (translationId === null) {
      // Remove primary, keep secondary as new primary
      if (selectedIds.length > 1) {
        await saveTranslations.mutateAsync([selectedIds[1]])
      } else {
        await saveTranslations.mutateAsync([])
      }
    } else {
      // Set new primary, keep secondary if exists
      const newIds = selectedIds.length > 1
        ? [translationId, selectedIds[1]]
        : [translationId]
      // Filter out duplicates
      await saveTranslations.mutateAsync([...new Set(newIds)])
    }
  }

  // Set secondary translation (replaces second slot)
  const setSecondaryTranslation = async (translationId: number | null) => {
    if (!selectedIds[0]) return // Need a primary first

    if (translationId === null) {
      // Remove secondary
      await saveTranslations.mutateAsync([selectedIds[0]])
    } else {
      // Set secondary
      if (translationId === selectedIds[0]) return // Can't be same as primary
      await saveTranslations.mutateAsync([selectedIds[0], translationId])
    }
  }

  // Legacy methods for backwards compatibility
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
    secondaryTranslation,
    setPrimaryTranslation,
    setSecondaryTranslation,
    addTranslation,
    removeTranslation,
    reorderTranslations,
    saveTranslations,
    isLoading,
    canAddMore,
    maxTranslations: MAX_TRANSLATIONS,
  }
}
