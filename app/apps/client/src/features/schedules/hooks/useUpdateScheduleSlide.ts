import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateScheduleSlide } from '../service'
import type { UpdateScheduleSlideInput } from '../types'

export function useUpdateScheduleSlide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scheduleId,
      itemId,
      input,
    }: {
      scheduleId: number
      itemId: number
      input: UpdateScheduleSlideInput
    }) => updateScheduleSlide(scheduleId, itemId, input),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
    },
  })
}
