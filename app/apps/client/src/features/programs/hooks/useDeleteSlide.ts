import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useProgramQueryKey } from './useProgram'
import { deleteSlide } from '../service/programs'

interface DeleteSlideInput {
  slideId: number
  programId: number
}

export function useDeleteSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ slideId }: DeleteSlideInput) => deleteSlide(slideId),
    onSuccess: (_, { programId }) => {
      queryClient.invalidateQueries({
        queryKey: useProgramQueryKey(programId),
      })
    },
  })
}
