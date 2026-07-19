import { useQuery } from '@tanstack/react-query'

import { getSyncPending } from '../service'

export const syncPendingQueryKey = ['sync', 'pending'] as const

/** Same cadence as the status query, so both panels refresh together. */
const PENDING_POLL_INTERVAL_MS = 30_000

/** Local changes waiting to be uploaded to Drive. */
export function useSyncPending() {
  return useQuery({
    queryKey: syncPendingQueryKey,
    queryFn: getSyncPending,
    refetchInterval: PENDING_POLL_INTERVAL_MS,
  })
}
