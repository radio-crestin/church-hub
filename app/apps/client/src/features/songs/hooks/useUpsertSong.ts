import { useMutation, useQueryClient } from '@tanstack/react-query'

import { upsertSong } from '../service'
import type { UpsertSongInput } from '../types'

export function useUpsertSong() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertSongInput) => upsertSong(input),
    onSuccess: (result) => {
      if (result.success && result.data) {
        queryClient.invalidateQueries({ queryKey: ['songs'] })
        queryClient.invalidateQueries({ queryKey: ['song', result.data.id] })
      }
    },
  })
}
