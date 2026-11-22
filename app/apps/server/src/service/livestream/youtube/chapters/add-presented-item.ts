import type { PresentedItem } from './presented-item'

/** YouTube ignores every chapter when one is shorter than this. */
export const MIN_CHAPTER_MS = 10_000

/** An item in the log: shown from `at` (ms since the epoch) until the next. */
export interface ChapterEntry extends PresentedItem {
  at: number
  /** Verses only: the first and last verse shown, one after the other. */
  verses?: { first: number; last: number }
}

/**
 * Adds what the screens show at `at` to the log (in place). A song's next
 * slide or a passage's next verse stays in its entry; the next verse of a
 * chapter extends the verse entry (Ioan 3:16 → Ioan 3:16-17); an entry shown
 * for less than MIN_CHAPTER_MS gives way to the next (passing through).
 */
export function addPresentedItem(
  log: ChapterEntry[],
  item: PresentedItem,
  at: number,
): void {
  const last = log.at(-1)
  if (last?.key === item.key) {
    if (!item.verse || !last.verses) return
    const { first, last: lastVerse } = last.verses
    if (item.verse.number >= first && item.verse.number <= lastVerse) return
    if (item.verse.number === lastVerse + 1) {
      last.verses.last = item.verse.number
      last.title = `${item.verse.chapterTitle}:${first}-${item.verse.number}`
      last.text = `${last.text}\n${item.text}`
      return
    }
  }
  if (last && at - last.at < MIN_CHAPTER_MS) {
    log.pop()
    addPresentedItem(log, item, at)
    return
  }
  log.push({
    ...item,
    at,
    verses: item.verse && {
      first: item.verse.number,
      last: item.verse.number,
    },
  })
}
