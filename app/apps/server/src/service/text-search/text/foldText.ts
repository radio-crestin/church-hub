import { decodeHtmlEntity, LEADING_HTML_ENTITY_RE } from './decodeHtmlEntities'
import { WORD_JOINERS } from './joinedWordVariants'

const JOINER_CHAR_RE = new RegExp(`^[${WORD_JOINERS}]$`, 'u')
const WORD_CHAR_RE = /^[\p{L}\p{N}]$/u

export interface FoldedText {
  /** Lowercase, diacritic-free, entity-decoded text with punctuation as spaces. */
  folded: string
  /** For each folded index, where that character starts in the original. */
  starts: number[]
  /** For each folded index, where that character ends (exclusive) in the original. */
  ends: number[]
}

export interface FoldOptions {
  /**
   * Drop hyphens/apostrophes that sit between letters, so "ne-ncetat" and
   * "ne&#039;ncetat" both fold to "nencetat". Off, they are kept as-is so
   * word boundaries inside "m-am" still exist.
   */
  dropJoiners: boolean
}

function foldChar(char: string): string {
  return char
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Folds text for matching while remembering where every folded character
 * came from, so a match found in the folded string can be mapped back to
 * the exact span of the original — entities, diacritics, joiners and all.
 */
export function foldText(text: string, options: FoldOptions): FoldedText {
  const folded: string[] = []
  const starts: number[] = []
  const ends: number[] = []

  let i = 0
  while (i < text.length) {
    let char: string
    let length: number
    if (text[i] === '&') {
      const entity = text.slice(i).match(LEADING_HTML_ENTITY_RE)
      if (entity) {
        char = decodeHtmlEntity(entity[0])
        length = entity[0].length
      } else {
        char = '&'
        length = 1
      }
    } else {
      const codePoint = text.codePointAt(i) ?? 0
      char = String.fromCodePoint(codePoint)
      length = char.length
    }

    const start = i
    const end = i + length
    i = end

    const lowered = foldChar(char)
    const isWord = WORD_CHAR_RE.test(lowered)
    const isJoiner = JOINER_CHAR_RE.test(lowered)

    if (isWord) {
      folded.push(lowered)
      starts.push(start)
      ends.push(end)
      continue
    }

    if (isJoiner) {
      const previous = folded[folded.length - 1]
      const betweenLetters =
        previous !== undefined &&
        WORD_CHAR_RE.test(previous) &&
        WORD_CHAR_RE.test(foldChar(nextChar(text, end)))
      if (betweenLetters) {
        if (options.dropJoiners) continue
        folded.push(lowered)
        starts.push(start)
        ends.push(end)
        continue
      }
    }

    // Everything else separates words; runs collapse into one space.
    if (folded.length > 0 && folded[folded.length - 1] !== ' ') {
      folded.push(' ')
      starts.push(start)
      ends.push(end)
    }
  }

  // A trailing separator carries nothing.
  if (folded[folded.length - 1] === ' ') {
    folded.pop()
    starts.pop()
    ends.pop()
  }

  return { folded: folded.join(''), starts, ends }
}

function nextChar(text: string, at: number): string {
  if (at >= text.length) return ''
  if (text[at] === '&') {
    const entity = text.slice(at).match(LEADING_HTML_ENTITY_RE)
    if (entity) return decodeHtmlEntity(entity[0])
  }
  return String.fromCodePoint(text.codePointAt(at) ?? 0)
}
