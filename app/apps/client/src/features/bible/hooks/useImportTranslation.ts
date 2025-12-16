import { useMutation, useQueryClient } from '@tanstack/react-query'

import { TRANSLATIONS_QUERY_KEY } from './useTranslations'
import { deleteTranslation, importTranslation } from '../service'

export function useImportTranslation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: importTranslation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSLATIONS_QUERY_KEY })
    },
  })
}

export function useDeleteTranslation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTranslation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSLATIONS_QUERY_KEY })
    },
  })
}
