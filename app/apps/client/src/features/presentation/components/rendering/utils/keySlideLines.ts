import { diffSlideLines } from '../../../utils/diffSlideLines'

export interface KeyedLines {
  /** A React key per line: a line shared with the previous text keeps its key */
  keys: string[]
  /** See SlideLineDiff.matchOf */
  matchOf: (number | null)[]
}

/**
 * Keys the lines of the next text so every line it shares with the previous
 * one keeps its key, and so its DOM node: a shared line is never remounted.
 * A new line gets a key made of `generation` (unique per text) and its index.
 */
export function keySlideLines(
  prevLines: string[],
  prevKeys: string[],
  nextLines: string[],
  generation: number,
): KeyedLines {
  const { matchOf } = diffSlideLines(prevLines, nextLines)
  const keys = matchOf.map((match, index) =>
    match === null ? `${generation}:${index}` : prevKeys[match],
  )
  return { keys, matchOf }
}
