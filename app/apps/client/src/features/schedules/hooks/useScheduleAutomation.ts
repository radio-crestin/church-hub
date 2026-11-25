import { useQuery } from '@tanstack/react-query'

import {
  getScheduleAutomation,
  scheduleAutomationQueryKey,
} from '../service/scheduleAutomation'

/**
 * What the presentation runner is doing. Fetched once; the server's
 * `schedule_automation` WebSocket message keeps it current.
 */
export function useScheduleAutomation() {
  return useQuery({
    queryKey: scheduleAutomationQueryKey,
    queryFn: getScheduleAutomation,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
