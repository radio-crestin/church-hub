import { useCallback, useEffect, useRef } from 'react'

import type { BibleNavigationState } from './useBibleNavigation'
import type { BibleVerse } from '../types'

export interface VerseTarget {
  bookId: number
  chapter: number
  verse: number
}

interface PresentWhenSelectedOptions {
  navigationState: BibleNavigationState
  verses: BibleVerse[]
  /** Shows the selected verse on screen (the page's own shortcut action). */
  showSelected: () => void
}

/**
 * Remembers a verse to show, and shows it once the page has selected it: a
 * double-click in History or Bookmarks navigates to the verse, whose chapter
 * may still be loading, then puts it on screen.
 */
export function usePresentWhenSelected({
  navigationState,
  verses,
  showSelected,
}: PresentWhenSelectedOptions) {
  const pendingRef = useRef<VerseTarget | null>(null)

  const showIfSelected = useCallback(() => {
    const target = pendingRef.current
    const { bookId, chapter, searchedIndex } = navigationState
    if (!target || searchedIndex === null) return
    const selected = verses[searchedIndex]
    const isTarget =
      bookId === target.bookId &&
      chapter === target.chapter &&
      selected?.verse === target.verse
    if (!isTarget) return
    pendingRef.current = null
    showSelected()
  }, [navigationState, verses, showSelected])

  useEffect(showIfSelected, [showIfSelected])

  return useCallback(
    (target: VerseTarget) => {
      pendingRef.current = target
      showIfSelected()
    },
    [showIfSelected],
  )
}
