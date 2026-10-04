import { useMutation, useQueryClient } from '@tanstack/react-query'

import { upsertSchedule } from '../service'
import type { UpsertScheduleInput } from '../types'

export function useUpsertSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertScheduleInput) => upsertSchedule(input),
    // Returned, so mutateAsync resolves only once the program list holds the
    // new program — a caller selecting it right away must find it there.
    onSuccess: (result) => {
      if (!result.success) return
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['schedules'] }),
        result.data?.id
          ? queryClient.invalidateQueries({
              queryKey: ['schedule', result.data.id],
            })
          : undefined,
      ])
    },
  })
}
