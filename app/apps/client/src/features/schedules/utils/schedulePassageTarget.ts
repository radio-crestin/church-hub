import type { ScheduleItem } from '../types'

export interface SchedulePassageTarget {
  bookName: string
  chapter: number
  verse: number
}

/**
 * Where a program's bible passage points to on the Bible page.
 *
 * A `bible_passage` item stores its per-verse reference ("Ioan 3:16") and the
 * translation abbreviation, but no book id and no book code — so the target is
 * recovered from that reference. The Bible route accepts `bookName` without an
 * id and resolves the book against the operator's primary translation, which is
 * the same fallback its own URL handler uses.
 *
 * Returns null for items that are not passages, or whose reference cannot be
 * parsed (hand-edited data).
 */
export function getSchedulePassageTarget(
  item: ScheduleItem,
): SchedulePassageTarget | null {
  if (item.itemType !== 'bible_passage') return null

  const reference =
    item.biblePassageVerses[0]?.reference ??
    // The item-level reference carries a " - ABBR" suffix; drop it.
    item.biblePassageReference?.split(' - ')[0] ??
    ''

  const match = reference.match(/^(.+?)\s+(\d+):(\d+)/)
  if (!match) return null

  const [, bookName, chapter, verse] = match
  return {
    bookName: bookName.trim(),
    chapter: Number(chapter),
    verse: Number(verse),
  }
}
