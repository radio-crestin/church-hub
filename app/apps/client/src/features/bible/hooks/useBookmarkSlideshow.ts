import { useMemo } from 'react'

import type { VerseteTineriEntry } from '~/features/presentation/types'
import { useVerseSlideshow } from './useVerseSlideshow'
import type { BibleBookmark } from '../service/bookmarks'

function toEntry(bookmark: BibleBookmark, index: number): VerseteTineriEntry {
  return {
    id: bookmark.id,
    personName: '',
    reference: bookmark.reference,
    bookCode: bookmark.bookCode,
    bookName: bookmark.bookName,
    startChapter: bookmark.chapter,
    startVerse: bookmark.verse,
    endChapter: bookmark.chapter,
    endVerse: bookmark.verse,
    text: bookmark.text,
    sortOrder: index,
  }
}

/** The bookmarks in the order their slideshow shows them: the list's. */
export function slideshowOrder(bookmarks: BibleBookmark[]): BibleBookmark[] {
  return [...bookmarks].sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * Shows the bookmarked verses on screen one after another, in the list's
 * order: stepped with the arrows, or with `loop` on by themselves and over
 * again.
 */
export function useBookmarkSlideshow(bookmarks: BibleBookmark[]) {
  const entries = useMemo(
    () => slideshowOrder(bookmarks).map(toEntry),
    [bookmarks],
  )
  const slideshow = useVerseSlideshow('bookmarks', entries)

  return {
    ...slideshow,
    // ▶ steps by hand; 🔁 plays on its own
    start: (loop: boolean, fromIndex?: number) =>
      slideshow.start(loop ? 'loop' : 'manual', fromIndex),
  }
}
