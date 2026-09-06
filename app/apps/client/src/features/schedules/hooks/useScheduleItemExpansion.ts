import { useCallback, useEffect, useRef, useState } from 'react'

import { useFollowPresentedScroll } from '~/hooks/useFollowPresentedScroll'
import type { ScheduleItem } from '../types'
import type { PresentedScheduleInfo } from '../utils/presentedScheduleInfo'
import { countScheduleItemSteps } from '../utils/scheduleFlatItems'

interface ExpandedState {
  [itemId: string]: boolean
}

interface UseScheduleItemExpansionOptions {
  /** localStorage key; distinct per list so two panels don't fight. */
  storageKey: string
  items: ScheduleItem[]
  presentedInfo: PresentedScheduleInfo | null
  itemStartFlatIndex: Record<number, number>
  /** Bumping this expands every item; bumping the other collapses every item. */
  expandAllTrigger?: number
  collapseAllTrigger?: number
}

/**
 * Which program items are open, and the scroll choreography that goes with it.
 *
 * The list follows the projector: whatever is live gets opened (and everything
 * else closed) and scrolled to, so the operator always sees the current step
 * with the one before it at the top of the panel.
 */
export function useScheduleItemExpansion({
  storageKey,
  items,
  presentedInfo,
  itemStartFlatIndex,
  expandAllTrigger,
  collapseAllTrigger,
}: UseScheduleItemExpansionOptions) {
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore parse errors — start collapsed
    }
    return {}
  })

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(expanded))
    } catch {
      // localStorage unavailable — expansion just won't persist.
    }
  }, [expanded, storageKey])

  // Drop entries for items that are gone; new items start collapsed.
  useEffect(() => {
    setExpanded((prev) => {
      const next: ExpandedState = {}
      items.forEach((item) => {
        next[`${item.id}`] = prev[`${item.id}`] ?? false
      })
      return next
    })
  }, [items])

  useEffect(() => {
    if (expandAllTrigger === undefined || expandAllTrigger <= 0) return
    setExpanded(() => {
      const next: ExpandedState = {}
      items.forEach((item) => {
        next[`${item.id}`] = true
      })
      return next
    })
  }, [expandAllTrigger, items])

  useEffect(() => {
    if (collapseAllTrigger === undefined || collapseAllTrigger <= 0) return
    setExpanded(() => {
      const next: ExpandedState = {}
      items.forEach((item) => {
        next[`${item.id}`] = false
      })
      return next
    })
  }, [collapseAllTrigger, items])

  // Follow the projector: open the item whose flat range holds the live step.
  useEffect(() => {
    if (!presentedInfo || presentedInfo.scheduleItemIndex < 0) return

    const presentedItem = items.find((item) => {
      const startIndex = itemStartFlatIndex[item.id]
      if (startIndex === undefined) return false
      const endIndex = startIndex + countScheduleItemSteps(item) - 1
      return (
        presentedInfo.scheduleItemIndex >= startIndex &&
        presentedInfo.scheduleItemIndex <= endIndex
      )
    })

    if (!presentedItem) return

    setExpanded(() => {
      const next: ExpandedState = {}
      items.forEach((item) => {
        next[`${item.id}`] = item.id === presentedItem.id
      })
      return next
    })
  }, [presentedInfo, items, itemStartFlatIndex])

  useFollowPresentedScroll(
    containerRef,
    highlightedRef,
    presentedInfo?.scheduleItemIndex ?? -1,
  )

  const toggleExpanded = useCallback((itemId: number) => {
    setExpanded((prev) => ({ ...prev, [`${itemId}`]: !prev[`${itemId}`] }))
  }, [])

  const isExpanded = useCallback(
    (itemId: number) => expanded[`${itemId}`] ?? false,
    [expanded],
  )

  return { expanded, isExpanded, toggleExpanded, highlightedRef, containerRef }
}
