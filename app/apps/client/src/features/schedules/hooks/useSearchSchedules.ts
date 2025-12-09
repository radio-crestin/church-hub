import { useQuery } from '@tanstack/react-query'

import { searchSchedules } from '../service'
import type { ScheduleSearchResult } from '../types'

export function useSearchSchedules(query: string) {
  return useQuery<ScheduleSearchResult[]>({
    queryKey: ['schedules', 'search', query],
    queryFn: () => searchSchedules(query),
    enabled: query.length > 0,
  })
}
