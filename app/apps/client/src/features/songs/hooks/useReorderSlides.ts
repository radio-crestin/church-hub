import { useMutation, useQueryClient } from '@tanstack/react-query'

import { reorderSongSlides } from '../service'

interface ReorderSlidesInput {
  songId: number
  slideIds: number[]
}

export function useReorderSlides() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ songId, slideIds }: ReorderSlidesInput) =>
      reorderSongSlides(songId, slideIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['song', variables.songId] })
    },
  })
}
