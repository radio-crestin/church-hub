import type { SlideLine } from './splitSlideLines'
import { diffSlideLines } from '../../../utils/diffSlideLines'
import { matchSequences } from '../../../utils/matchSequences'

export interface KeyedLines {
  /** A React key per line: a line kept or changed in place keeps its key */
  lineKeys: string[]
  /** A React key per token: a token kept in its line keeps its key */
  tokenKeys: string[][]
  /** Per line, the previous line it continues (SlideLineDiff.matchOf) */
  lineMatch: (number | null)[]
  /** Per token of a continued line, the previous token it keeps, else null */
  tokenMatch: (number | null)[][]
}

export interface DrawnKeys {
  lines: SlideLine[]
  lineKeys: string[]
  tokenKeys: string[][]
}

const textsOf = (line: SlideLine) => line.tokens.map((token) => token.text)

/**
 * Keys the lines and words of the next text so everything it keeps from the
 * previous one keeps its key, and so its DOM node: a kept line or word is
 * never remounted. New ones get keys made of `generation` (unique per text)
 * and their place.
 */
export function keySlideLines(
  prev: DrawnKeys,
  next: SlideLine[],
  generation: number,
): KeyedLines {
  const { matchOf: lineMatch } = diffSlideLines(
    prev.lines.map((line) => line.text),
    next.map((line) => line.text),
  )
  const lineKeys: string[] = []
  const tokenKeys: string[][] = []
  const tokenMatch: (number | null)[][] = []
  next.forEach((line, index) => {
    const match = lineMatch[index]
    const fresh = `${generation}:${index}`
    const tokens =
      match === null
        ? line.tokens.map(() => null)
        : matchSequences(textsOf(prev.lines[match]), textsOf(line))
    lineKeys.push(match === null ? `L${fresh}` : prev.lineKeys[match])
    tokenMatch.push(tokens)
    tokenKeys.push(
      tokens.map((token, i) =>
        match !== null && token !== null
          ? prev.tokenKeys[match][token]
          : `T${fresh}:${i}`,
      ),
    )
  })
  return { lineKeys, tokenKeys, lineMatch, tokenMatch }
}
