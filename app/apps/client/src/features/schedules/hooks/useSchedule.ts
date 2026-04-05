import { useQuery } from '@tanstack/react-query'

import { createLogger } from '~/utils/logger'
import { getScheduleById } from '../service'
import type { ScheduleWithItems } from '../types'

const logger = createLogger('app:schedules')

export function useSchedule(id: number | undefined) {
  return useQuery<ScheduleWithItems | null>({
    queryKey: ['schedule', id],
    queryFn: async () => {
      logger.debug(`Fetching schedule id=${id}`)
      const schedule = await getScheduleById(id!)
      logger.debug(
        `Fetched schedule: ${schedule?.title ?? 'null'} with ${schedule?.items?.length ?? 0} items`,
      )
      return schedule
    },
    enabled: id !== undefined && id > 0,
    staleTime: 30 * 1000, // 30 seconds - data stays fresh, prevents constant refetching
  })
}
