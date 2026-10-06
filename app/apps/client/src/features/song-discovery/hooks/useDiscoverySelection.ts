import { useCallback, useMemo, useState } from 'react'

import { useCategories } from '~/features/songs/hooks'
import type { SongSource } from '../providers'
import type { CandidateDraft, LackingEntry, StagingItem } from '../types'
import { buildDraft } from '../utils/buildDraft'

interface Override {
  selected?: boolean
  draft?: CandidateDraft
}

/**
 * What the user picked in Song discovery: every source and every song is
 * picked until unticked. Edits to a song stay with it; imported songs leave
 * the list.
 */
export function useDiscoverySelection(
  entries: LackingEntry[],
  sources: SongSource[],
  /** Only this source is ticked at first (an opened song file, say). */
  focusSourceId?: string,
) {
  const { data: categories } = useCategories()
  // Sources the user ticked or unticked, against the first state.
  const [toggledSources, setToggledSources] = useState<Set<string>>(
    () => new Set(),
  )
  const isSourceChecked = useCallback(
    (sourceId: string) =>
      (focusSourceId ? sourceId === focusSourceId : true) !==
      toggledSources.has(sourceId),
    [focusSourceId, toggledSources],
  )
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [imported, setImported] = useState<Set<string>>(() => new Set())

  const remaining = useMemo(
    () => entries.filter((e) => !imported.has(e.candidate.tempId)),
    [entries, imported],
  )

  const items = useMemo<StagingItem[]>(() => {
    const categoryId = (sourceId: string) => {
      const name = sources.find((s) => s.id === sourceId)?.categoryName
      return categories?.find((c) => c.name === name)?.id ?? null
    }
    return remaining
      .filter((entry) => isSourceChecked(entry.sourceId))
      .map((entry) => {
        const { tempId } = entry.candidate
        const override = overrides[tempId]
        return {
          tempId,
          sourceId: entry.sourceId,
          candidate: entry.candidate,
          verdict: entry.verdict,
          similar: entry.similar,
          draft:
            override?.draft ??
            buildDraft(entry.candidate, categoryId(entry.sourceId)),
          selected: override?.selected ?? true,
        }
      })
  }, [remaining, isSourceChecked, overrides, sources, categories])

  /** Songs left to import per source, picked or not. */
  const countBySource = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of remaining) {
      counts.set(entry.sourceId, (counts.get(entry.sourceId) ?? 0) + 1)
    }
    return counts
  }, [remaining])

  const override = (tempIds: string[], change: Override) =>
    setOverrides((previous) => {
      const next = { ...previous }
      for (const id of tempIds) next[id] = { ...next[id], ...change }
      return next
    })

  return {
    items,
    countBySource,
    isSourceChecked,
    toggleSource: (sourceId: string) =>
      setToggledSources((previous) => {
        const next = new Set(previous)
        if (!next.delete(sourceId)) next.add(sourceId)
        return next
      }),
    setSelected: (tempIds: string[], selected: boolean) =>
      override(tempIds, { selected }),
    setDraft: (tempId: string, draft: CandidateDraft) =>
      override([tempId], { draft }),
    markImported: (tempIds: string[]) =>
      setImported((previous) => new Set([...previous, ...tempIds])),
  }
}
