import { useMutation, useQueryClient } from '@tanstack/react-query'

import { upsertSchedule } from '../service'
import type { UpsertScheduleInput } from '../types'

export function useUpsertSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertScheduleInput) => upsertSchedule(input),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['schedules'] })
        if (result.data?.id) {
          queryClient.invalidateQueries({
            queryKey: ['schedule', result.data.id],
          })
        }
      }
    },
  })
}
