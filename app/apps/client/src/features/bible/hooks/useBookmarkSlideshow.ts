import {
  useClearTemporaryContent,
  usePresentationState,
  usePresentTemporaryVerseteTineri,
} from '~/features/presentation'
import type { VerseteTineriEntry } from '~/features/presentation/types'
import type { BibleBookmark } from '../service/bookmarks'
import { getBookmarkSlideshow } from '../utils/getBookmarkSlideshow'

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

/**
 * Shows the bookmarked verses on screen one after another, in the list's
 * order, as a Versete Biblice slide. With `loop` the server moves on by itself
 * after each verse's reading time and starts over after the last one.
 */
export function useBookmarkSlideshow(bookmarks: BibleBookmark[]) {
  const { data: state } = usePresentationState()
  const present = usePresentTemporaryVerseteTineri()
  const clear = useClearTemporaryContent()

  const slideshow = getBookmarkSlideshow(state)

  const start = (loop: boolean) => {
    const ordered = [...bookmarks].sort((a, b) => a.sortOrder - b.sortOrder)
    if (ordered.length === 0) return
    present.mutate({
      entries: ordered.map(toEntry),
      currentEntryIndex: 0,
      loop,
    })
  }

  return {
    isPlaying: slideshow !== null,
    isLooping: !!slideshow?.loop,
    position: slideshow
      ? { index: slideshow.currentEntryIndex, count: slideshow.entries.length }
      : null,
    start,
    stop: () => clear.mutate(),
  }
}
