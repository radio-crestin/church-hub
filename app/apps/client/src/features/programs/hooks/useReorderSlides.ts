import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useProgramQueryKey } from './useProgram'
import { reorderSlides } from '../service/programs'

interface ReorderSlidesInput {
  programId: number
  slideIds: number[]
}

export function useReorderSlides() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ programId, slideIds }: ReorderSlidesInput) =>
      reorderSlides(programId, slideIds),
    onSuccess: (_, { programId }) => {
      queryClient.invalidateQueries({
        queryKey: useProgramQueryKey(programId),
      })
    },
  })
}
