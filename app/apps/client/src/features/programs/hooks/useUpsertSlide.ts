import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useProgramQueryKey } from './useProgram'
import { upsertSlide } from '../service/programs'
import type { UpsertSlideInput } from '../types'

export function useUpsertSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertSlideInput) => upsertSlide(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: useProgramQueryKey(data.programId),
      })
    },
  })
}
