import { useMutation, useQueryClient } from '@tanstack/react-query'

import { setScheduleItemConfig } from '../service/scheduleItemsApi'
import type { ItemConfig } from '../types'

interface Variables {
  scheduleId: number
  itemId: number
  itemConfig: ItemConfig
}

/** Saves an item's settings; the presentation is read again with its picks. */
export function useSetScheduleItemConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ scheduleId, itemId, itemConfig }: Variables) =>
      setScheduleItemConfig(scheduleId, itemId, itemConfig),
    onSettled: (_data, _error, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
    },
  })
}
