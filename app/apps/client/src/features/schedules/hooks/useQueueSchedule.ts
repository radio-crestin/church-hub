import { useQuery } from '@tanstack/react-query'

import { getQueueSchedule } from '../service'

/**
 * The control room's queue with its items. Under `schedules`, so adding,
 * removing or reordering any presentation's items reads it again.
 */
export function useQueueSchedule() {
  return useQuery({
    queryKey: ['schedules', 'queue'],
    queryFn: getQueueSchedule,
    staleTime: 30 * 1000,
  })
}
