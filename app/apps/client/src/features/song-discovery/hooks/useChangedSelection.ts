import { useMemo, useState } from 'react'

import type { ChangedEntry } from './useChangedSongs'
import { useSongUpdates } from './useSongUpdates'

export interface ChangedItem extends ChangedEntry {
  /** Picked to be updated by the next "apply". */
  selected: boolean
}

/**
 * The changed songs the user picks to update (all at first), and their
 * choice for each: update it, or keep the library's. A song updated or
 * kept leaves the list.
 */
export function useChangedSelection(
  entries: ChangedEntry[],
  isSourceChecked: (sourceId: string) => boolean,
) {
  const { resolveChanged, isResolving } = useSongUpdates()
  const [unselected, setUnselected] = useState<Set<string>>(() => new Set())
  const [resolved, setResolved] = useState<Set<string>>(() => new Set())

  const remaining = useMemo(
    () => entries.filter((entry) => !resolved.has(entry.key)),
    [entries, resolved],
  )
  const items = useMemo<ChangedItem[]>(
    () =>
      remaining
        .filter((entry) => isSourceChecked(entry.sourceId))
        .map((entry) => ({ ...entry, selected: !unselected.has(entry.key) })),
    [remaining, isSourceChecked, unselected],
  )

  /** Songs left to choose for, per source. */
  const countBySource = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { sourceId } of remaining) {
      counts.set(sourceId, (counts.get(sourceId) ?? 0) + 1)
    }
    return counts
  }, [remaining])

  /** Updates or keeps these songs, one request per source. */
  const resolve = async (picked: ChangedItem[], action: 'update' | 'keep') => {
    const bySource = new Map<string, ChangedItem[]>()
    for (const item of picked) {
      bySource.set(item.sourceId, [
        ...(bySource.get(item.sourceId) ?? []),
        item,
      ])
    }
    for (const [sourceId, songs] of bySource) {
      await resolveChanged({
        sourceId,
        songIds: songs.map((song) => song.songId),
        action,
      })
      setResolved(
        (previous) => new Set([...previous, ...songs.map((s) => s.key)]),
      )
    }
  }

  return {
    items,
    countBySource,
    isResolving,
    setSelected: (keys: string[], selected: boolean) =>
      setUnselected((previous) => {
        const next = new Set(previous)
        for (const key of keys) {
          if (selected) next.delete(key)
          else next.add(key)
        }
        return next
      }),
    resolve,
  }
}
