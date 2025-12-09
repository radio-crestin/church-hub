import { useQuery } from '@tanstack/react-query'

import { getAllSchedules } from '../service'
import type { Schedule } from '../types'

export function useSchedules() {
  return useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: getAllSchedules,
  })
}
