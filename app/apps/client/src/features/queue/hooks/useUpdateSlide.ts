import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateSlideInQueue } from '../service/queue'
import type { UpdateSlideInput } from '../types'

export function useUpdateSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateSlideInput) => updateSlideInQueue(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}
