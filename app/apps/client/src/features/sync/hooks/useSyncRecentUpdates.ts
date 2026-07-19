import { useQuery } from '@tanstack/react-query'

import { getSyncUpdates } from '../service'

export const syncRecentUpdatesQueryKey = ['sync', 'updates', 'recent'] as const

/** Same cadence as the status query, so both panels refresh together. */
const RECENT_POLL_INTERVAL_MS = 30_000

/**
 * Recent sync history (seen + unseen, newest first) for the settings
 * "Received from other devices" panel. Separate cache entry from the
 * unseen-only badge query; both share the `['sync', 'updates']` prefix so a
 * single invalidation (WS event, mark-seen) refreshes them together.
 */
export function useSyncRecentUpdates() {
  return useQuery({
    queryKey: syncRecentUpdatesQueryKey,
    queryFn: () => getSyncUpdates(false),
    refetchInterval: RECENT_POLL_INTERVAL_MS,
  })
}
