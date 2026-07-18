import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { SyncChangeKind, SyncEntityType } from '../service'
import { getSyncUpdates } from '../service'

export const syncUpdatesQueryKey = ['sync', 'updates', 'unseen'] as const

/**
 * Unseen sync updates (remote changes applied locally and not yet reviewed).
 * Shared by every badge consumer through the query cache; invalidated when a
 * `sync_applied` WebSocket event arrives or an entry is marked seen.
 */
export function useSyncUpdates() {
  return useQuery({
    queryKey: syncUpdatesQueryKey,
    queryFn: () => getSyncUpdates(true),
    staleTime: 30_000,
  })
}

/**
 * Unseen updates for one entity type as a `localId -> changeKind` map, for
 * cheap per-row badge lookups in the songs/schedules lists. When an entity has
 * several unseen entries, `conflict` wins so the warning is never hidden.
 */
export function useSyncUpdatesMap(
  entityType: SyncEntityType,
): Map<number, SyncChangeKind> {
  const { data: updates } = useSyncUpdates()

  return useMemo(() => {
    const map = new Map<number, SyncChangeKind>()
    for (const update of updates ?? []) {
      if (update.entityType !== entityType || update.localId === null) continue
      if (map.get(update.localId) === 'conflict') continue
      map.set(update.localId, update.changeKind)
    }
    return map
  }, [updates, entityType])
}
