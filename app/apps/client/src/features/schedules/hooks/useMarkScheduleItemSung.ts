import { useMutation, useQueryClient } from '@tanstack/react-query'

import { markScheduleItemSung } from '../service'
import type { ScheduleWithItems } from '../types'

interface MarkScheduleItemSungVariables {
  scheduleId: number
  itemId: number
  isSung: boolean
}

/**
 * Toggles the "already sung" marker on a schedule song. Optimistic, mirroring
 * `useMarkBookmarkSung` — the checkmark has to feel instant while an operator
 * ticks songs off during a service.
 */
export function useMarkScheduleItemSung() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scheduleId,
      itemId,
      isSung,
    }: MarkScheduleItemSungVariables) =>
      markScheduleItemSung(scheduleId, itemId, isSung),
    onMutate: async ({ scheduleId, itemId, isSung }) => {
      const queryKey = ['schedule', scheduleId]
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<ScheduleWithItems | null>(
        queryKey,
      )
      queryClient.setQueryData<ScheduleWithItems | null>(queryKey, (current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === itemId
                  ? { ...item, isSung, sungAt: isSung ? Date.now() : null }
                  : item,
              ),
            }
          : current,
      )

      return { previous, queryKey }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
    },
    onSettled: (_data, _error, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
    },
  })
}
