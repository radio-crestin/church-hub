import { useMutation, useQueryClient } from '@tanstack/react-query'

import { saveQueueAsSchedule } from '../service'

export function useSaveQueueAsSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (title: string) => saveQueueAsSchedule(title),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate schedules to show the new schedule
        queryClient.invalidateQueries({ queryKey: ['schedules'] })
      }
    },
  })
}
