import { useQuery } from '@tanstack/react-query'

import { createLogger } from '~/utils/logger'
import { getAllSchedules } from '../service'
import type { Schedule } from '../types'

const logger = createLogger('app:schedules')

export function useSchedules() {
  return useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: async () => {
      logger.debug('Fetching all schedules')
      const schedules = await getAllSchedules()
      logger.debug(`Fetched ${schedules.length} schedules`)
      return schedules
    },
    staleTime: 30 * 1000, // 30 seconds - data stays fresh, prevents constant refetching
  })
}
