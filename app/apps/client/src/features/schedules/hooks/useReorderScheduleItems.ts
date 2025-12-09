import { useMutation, useQueryClient } from '@tanstack/react-query'

import { reorderScheduleItems } from '../service'
import type { ReorderScheduleItemsInput } from '../types'

export function useReorderScheduleItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scheduleId,
      input,
    }: {
      scheduleId: number
      input: ReorderScheduleItemsInput
    }) => reorderScheduleItems(scheduleId, input),
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
    },
  })
}
