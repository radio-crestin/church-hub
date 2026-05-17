import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { upsertSong } from '../service'
import type { UpsertSongInput } from '../types'

export function useUpsertSong() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { t } = useTranslation('songs')

  return useMutation({
    mutationFn: (input: UpsertSongInput) => upsertSong(input),
    onSuccess: (result) => {
      if (result.success && result.data) {
        queryClient.invalidateQueries({ queryKey: ['songs'] })
        queryClient.invalidateQueries({ queryKey: ['song', result.data.id] })
        return
      }
      // Server returned { error } — surface it so the user knows the save failed.
      showToast(result.error || t('messages.error'), 'error')
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error)
      showToast(message || t('messages.error'), 'error')
    },
  })
}
