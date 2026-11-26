export interface SlideLineDiff {
  /**
   * For each line of the next slide, the index of the same line in the
   * previous slide, or null when the line is new there.
   */
  matchOf: (number | null)[]
  /** How many non-blank lines the two slides share. */
  shared: number
}

/**
 * Pairs the lines two slides have in common, in reading order: the longest
 * run of identical lines both slides keep in the same order (an LCS). A chorus
 * repeated with one line changed shares every other line; a line added on top
 * still leaves the lines under it shared. Blank lines can pair up but don't
 * count as shared, so two slides that only have blank lines in common share
 * nothing.
 */
export function diffSlideLines(prev: string[], next: string[]): SlideLineDiff {
  // lengths[i][j]: the longest common run of prev[i..] and next[j..]
  const lengths = Array.from({ length: prev.length + 1 }, () =>
    new Array<number>(next.length + 1).fill(0),
  )
  for (let i = prev.length - 1; i >= 0; i--) {
    for (let j = next.length - 1; j >= 0; j--) {
      lengths[i][j] =
        prev[i] === next[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const matchOf = new Array<number | null>(next.length).fill(null)
  let shared = 0
  let i = 0
  let j = 0
  while (i < prev.length && j < next.length) {
    if (prev[i] === next[j]) {
      matchOf[j] = i
      if (next[j].trim()) shared++
      i++
      j++
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return { matchOf, shared }
}
