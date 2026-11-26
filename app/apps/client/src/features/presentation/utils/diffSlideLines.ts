import { matchSequences } from './matchSequences'
import { tokenizeLine } from './tokenizeLine'

export interface SlideLineDiff {
  /**
   * For each line of the next slide, the line of the previous slide it
   * continues: the same line, or one it changes only some words of. Null for
   * a new line.
   */
  matchOf: (number | null)[]
  /** How many non-blank lines the two slides keep or change in place. */
  shared: number
}

const isWord = (token: string) => token.trim() !== ''

/**
 * Whether `next` is `prev` with some words changed rather than another line:
 * at least half the words of the longer one are kept, in order.
 */
function changesWordsOf(prev: string, next: string): boolean {
  const prevWords = tokenizeLine(prev).filter(isWord)
  const nextWords = tokenizeLine(next).filter(isWord)
  const kept = matchSequences(prevWords, nextWords).filter(
    (match) => match !== null,
  ).length
  return kept > 0 && kept * 2 >= Math.max(prevWords.length, nextWords.length)
}

/**
 * Pairs the lines of two slides in reading order. Identical lines pair first
 * (the longest run both keep in order); then, between two such lines, the
 * remaining lines pair up one by one where the new line only changes some
 * words of the old one ("… slide 1" → "… slide 2"). Blank lines can pair but
 * don't count as shared, so slides with only blank lines in common share
 * nothing.
 */
export function diffSlideLines(prev: string[], next: string[]): SlideLineDiff {
  const matchOf = matchSequences(prev, next)

  // Between two identical lines (or an end), old and new lines pair in order.
  let prevStart = 0
  let gap: number[] = []
  const pairGap = (prevEnd: number) => {
    gap.forEach((nextIndex, offset) => {
      const prevIndex = prevStart + offset
      if (
        prevIndex < prevEnd &&
        changesWordsOf(prev[prevIndex], next[nextIndex])
      ) {
        matchOf[nextIndex] = prevIndex
      }
    })
    gap = []
  }
  matchOf.forEach((match, nextIndex) => {
    if (match === null) {
      gap.push(nextIndex)
      return
    }
    pairGap(match)
    prevStart = match + 1
  })
  pairGap(prev.length)

  const shared = matchOf.filter(
    (match, nextIndex) => match !== null && next[nextIndex].trim(),
  ).length
  return { matchOf, shared }
}
