import { useMutation, useQueryClient } from '@tanstack/react-query'

import { upsertSong } from '../service'
import type { UpsertSongInput } from '../types'

export function useUpsertSong() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertSongInput) => upsertSong(input),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['songs'] })
        if (result.id) {
          queryClient.invalidateQueries({ queryKey: ['song', result.id] })
        }
      }
    },
  })
}
