import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { SONG_BOOKMARKS_QUERY_KEY } from '~/features/songs/hooks/useSongBookmarks'
import { useToast } from '~/ui/toast'
import { songHistoryQueryKey } from './useSongHistory'
import { restoreSongVersion } from '../service/songHistory'
import type { RestoreSide } from '../types'

interface RestoreInput {
  entryId: number
  side: RestoreSide
}

export function useRestoreSongVersion(songId: number) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { t } = useTranslation('songHistory')

  return useMutation({
    mutationFn: ({ entryId, side }: RestoreInput) =>
      restoreSongVersion(songId, entryId, side),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      queryClient.invalidateQueries({ queryKey: ['song', songId] })
      queryClient.invalidateQueries({ queryKey: SONG_BOOKMARKS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: songHistoryQueryKey(songId) })
      showToast(t('restore.success'), 'success')
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : t('restore.error'),
        'error',
      )
    },
  })
}
