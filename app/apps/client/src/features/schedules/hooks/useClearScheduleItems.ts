import { useMutation, useQueryClient } from '@tanstack/react-query'

import { replaceScheduleItems } from '../service'

/** Removes every item of a presentation (the control room clearing its queue). */
export function useClearScheduleItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scheduleId: number) =>
      replaceScheduleItems(scheduleId, { items: [] }),
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
    },
  })
}
