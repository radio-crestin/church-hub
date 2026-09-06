/**
 * Formats a passage reference string for cross-chapter or same-chapter ranges.
 *
 * "Ioan 3:16", "Ioan 3:16-18", "Ioan 3:16 - 4:2", plus an optional
 * " - <ABBR>" translation suffix used only by the display references stored on
 * `schedule_items.bible_passage_reference`.
 */
export function formatPassageReference(
  bookName: string,
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number,
  translationAbbreviation?: string,
): string {
  let ref: string
  if (startChapter === endChapter) {
    if (startVerse === endVerse) {
      ref = `${bookName} ${startChapter}:${startVerse}`
    } else {
      ref = `${bookName} ${startChapter}:${startVerse}-${endVerse}`
    }
  } else {
    ref = `${bookName} ${startChapter}:${startVerse} - ${endChapter}:${endVerse}`
  }
  return translationAbbreviation ? `${ref} - ${translationAbbreviation}` : ref
}
