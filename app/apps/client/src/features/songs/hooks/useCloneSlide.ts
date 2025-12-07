import { useMutation, useQueryClient } from '@tanstack/react-query'

import { cloneSongSlide } from '../service'

interface CloneSlideInput {
  slideId: number
  songId: number
}

export function useCloneSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ slideId }: CloneSlideInput) => cloneSongSlide(slideId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['song', variables.songId] })
    },
  })
}
