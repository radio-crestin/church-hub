import { useMutation, useQueryClient } from '@tanstack/react-query'

import { presentedSongsQueryKey } from './usePresentedSongs'
import { upsertSong } from '../../songs/service'

interface UpdateKeyLineInput {
  songId: number
  songTitle: string
  keyLine: string
}

export function useUpdateSongKeyLine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ songId, songTitle, keyLine }: UpdateKeyLineInput) => {
      const result = await upsertSong({
        id: songId,
        title: songTitle,
        keyLine: keyLine || null,
      })
      return result
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: presentedSongsQueryKey })
        queryClient.invalidateQueries({ queryKey: ['songs'] })
        if (result.data) {
          queryClient.invalidateQueries({ queryKey: ['song', result.data.id] })
        }
      }
    },
  })
}
