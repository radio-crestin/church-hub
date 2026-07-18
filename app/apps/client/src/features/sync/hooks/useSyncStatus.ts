import { useQuery } from '@tanstack/react-query'

import { getSyncStatus } from '../service'

export const syncStatusQueryKey = ['sync', 'status'] as const

/** Poll cadence while a consumer (e.g. the settings section) is mounted. */
const STATUS_POLL_INTERVAL_MS = 30_000

export function useSyncStatus() {
  return useQuery({
    queryKey: syncStatusQueryKey,
    queryFn: getSyncStatus,
    refetchInterval: STATUS_POLL_INTERVAL_MS,
  })
}
