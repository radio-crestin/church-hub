import { useMutation, useQueryClient } from '@tanstack/react-query'

import { addItemToSchedule } from '../service'
import type { AddToScheduleInput } from '../types'

export function useAddItemToSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scheduleId,
      input,
    }: {
      scheduleId: number
      input: AddToScheduleInput
    }) => addItemToSchedule(scheduleId, input),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
    },
  })
}
