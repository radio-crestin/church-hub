import { useMutation, useQueryClient } from '@tanstack/react-query'

import { importScheduleToQueue } from '../service'

export function useImportScheduleToQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (scheduleId: number) => importScheduleToQueue(scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}
