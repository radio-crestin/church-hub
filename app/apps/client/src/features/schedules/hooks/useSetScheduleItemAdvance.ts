import { useMutation, useQueryClient } from '@tanstack/react-query'

import { setScheduleItemAdvance } from '../service'
import type { ScheduleWithItems } from '../types'

interface Variables {
  scheduleId: number
  itemId: number
  advanceSeconds: number | null
}

/**
 * Sets an item's own time per slide. Optimistic, so the time beside the item
 * changes as soon as it is set.
 */
export function useSetScheduleItemAdvance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ scheduleId, itemId, advanceSeconds }: Variables) =>
      setScheduleItemAdvance(scheduleId, itemId, advanceSeconds),
    onMutate: async ({ scheduleId, itemId, advanceSeconds }) => {
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
                item.id === itemId ? { ...item, advanceSeconds } : item,
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
