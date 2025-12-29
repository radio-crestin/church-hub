import { useQuery } from '@tanstack/react-query'

import { getScheduleById } from '../service'
import type { ScheduleWithItems } from '../types'

export function useSchedule(id: number) {
  return useQuery<ScheduleWithItems | null>({
    queryKey: ['schedule', id],
    queryFn: () => getScheduleById(id),
    enabled: id > 0,
    staleTime: 30 * 1000, // 30 seconds - data stays fresh, prevents constant refetching
  })
}
