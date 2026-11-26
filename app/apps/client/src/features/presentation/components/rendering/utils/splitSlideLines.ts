import type { TextStyleRange } from '../../../types'
import { applyStylesToText } from '../../../utils/applyStylesToText'
import { offsetStyleRanges } from '../../../utils/offsetStyleRanges'
import { type TokenMode, tokenizeLine } from '../../../utils/tokenizeLine'

/** A word or the spaces after it, with one style all along. */
export interface SlideToken {
  text: string
  /** The text with the slide's styled runs, or null when it has none */
  html: string | null
  /**
   * A word (or a part of a reference), drawn as its own element so it can
   * fade. Spaces, and the whole runs of a text that isn't cut into words, are
   * drawn as plain text.
   */
  isWord: boolean
  /**
   * A whole word, drawn as a box so it can glide to a new place. The parts of
   * a reference ("3", ":", "16") stay inline, so they wrap exactly as the
   * text did.
   */
  glides: boolean
}

export interface SlideLine {
  /** The line's text, as slides are compared */
  text: string
  tokens: SlideToken[]
  /** Whether a line break follows the line */
  breaks: boolean
}

/** Where a line's tokens start, with every styled run's edges added. */
function tokenStarts(
  line: string,
  lineStart: number,
  ranges: TextStyleRange[] | undefined,
  split: TokenMode | null,
): number[] {
  const starts = new Set<number>(line ? [0] : [])
  let at = 0
  for (const token of split ? tokenizeLine(line, split) : []) {
    starts.add(at)
    at += token.length
  }
  for (const range of ranges ?? []) {
    for (const edge of [range.start - lineStart, range.end - lineStart]) {
      if (edge > 0 && edge < line.length) starts.add(edge)
    }
  }
  return [...starts].sort((a, b) => a - b)
}

/**
 * Cuts a slide's text into lines and, when `split` says how (TokenMode),
 * each line into words and spaces, so a slide change can animate single
 * words (or, in a Bible reference, a single verse number). Joined back the
 * pieces are exactly the text, so selections count the same characters and
 * the text lays out as before. A styled run is cut at its edges, and every
 * piece carries its own styling markup.
 */
export function splitSlideLines(
  text: string,
  ranges: TextStyleRange[] | undefined,
  split: TokenMode | null,
): SlideLine[] {
  const lines = text.split('\n')
  let lineStart = 0
  return lines.map((line, index) => {
    const starts = tokenStarts(line, lineStart, ranges, split)
    const tokens = starts.map((start, i): SlideToken => {
      const piece = line.slice(start, starts[i + 1] ?? line.length)
      const pieceRanges = offsetStyleRanges(ranges, -(lineStart + start))
      return {
        text: piece,
        html: pieceRanges?.length
          ? applyStylesToText(piece, pieceRanges)
          : null,
        isWord: split !== null && piece.trim() !== '',
        glides: split === 'words' && piece.trim() !== '',
      }
    })
    const breaks = index < lines.length - 1
    lineStart += line.length + (breaks ? 1 : 0)
    return { text: line, tokens, breaks }
  })
}
