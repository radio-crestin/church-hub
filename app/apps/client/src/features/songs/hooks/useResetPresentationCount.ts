import { useMutation, useQueryClient } from '@tanstack/react-query'

import { resetSongPresentationCount } from '../service'

export function useResetPresentationCount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (songId: number) => resetSongPresentationCount(songId),
    onSuccess: (result) => {
      if (result) {
        queryClient.invalidateQueries({ queryKey: ['songs'] })
        queryClient.invalidateQueries({ queryKey: ['song', result.id] })
      }
    },
  })
}
