import { useEffect, useRef } from 'react'

import { useMarkSyncUpdatesSeen } from './useMarkSyncUpdatesSeen'
import { useSyncUpdates } from './useSyncUpdates'
import type { SyncEntityType } from '../service'

/**
 * Clears the "updated elsewhere" badge for an opened song/schedule: when the
 * entity with `localId` has unseen sync updates, they are marked seen once.
 */
export function useMarkEntitySeen(
  entityType: SyncEntityType,
  localId: number | null,
) {
  const { data: updates } = useSyncUpdates()
  const { mutate: markSeen } = useMarkSyncUpdatesSeen()
  // Ids already sent, so a slow invalidation round-trip can't re-fire them.
  const markedIdsRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (localId === null || !updates) return
    const ids = updates
      .filter(
        (u) =>
          u.entityType === entityType &&
          u.localId === localId &&
          !markedIdsRef.current.has(u.id),
      )
      .map((u) => u.id)
    if (ids.length === 0) return
    for (const id of ids) markedIdsRef.current.add(id)
    markSeen(ids)
  }, [entityType, localId, updates, markSeen])
}
