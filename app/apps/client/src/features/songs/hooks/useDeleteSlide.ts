import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteSongSlide } from '../service'

interface DeleteSlideInput {
  slideId: number
  songId: number
}

export function useDeleteSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ slideId }: DeleteSlideInput) => deleteSongSlide(slideId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['song', variables.songId] })
    },
  })
}
