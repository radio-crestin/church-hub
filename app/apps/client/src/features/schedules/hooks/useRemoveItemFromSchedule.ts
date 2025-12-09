import { useMutation, useQueryClient } from '@tanstack/react-query'

import { removeItemFromSchedule } from '../service'

export function useRemoveItemFromSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scheduleId,
      itemId,
    }: {
      scheduleId: number
      itemId: number
    }) => removeItemFromSchedule(scheduleId, itemId),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
    },
  })
}
