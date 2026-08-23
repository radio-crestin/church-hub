import { elisionVariants } from './elisionVariants'
import { foldText } from './foldText'
import { joinedWordVariants, WORD_JOINERS } from './joinedWordVariants'

export interface TextRange {
  start: number
  end: number
}

export interface FindHighlightRangesOptions {
  /** The query as the user typed it; tried first as a literal phrase. */
  rawQuery?: string
  /**
   * Also mark a word that merely contains the middle of a long term — a
   * loose net for the content snippet ("Hristos" lighting up "Cristos").
   */
  fuzzy?: boolean
}

function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const JOINER_SPLIT_RE = new RegExp(`[${WORD_JOINERS}]+`, 'u')

/**
 * Normalises the raw user query into the literal phrase looked for as a
 * substring of the text. Strips the leading hymn-number prefix (mirrors
 * extractSearchTerms), removes diacritics, lowercases and collapses
 * whitespace. Keeps internal hyphens so incremental typing like
 * "Cand Isus Hristos m" → "m-" → "m-a" widens the mark one character at a
 * time.
 */
function cleanQueryForHighlight(rawQuery: string): string {
  return removeDiacritics(rawQuery)
    .replace(/^\s*\d+[.\-]?\s+/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Returns true if the gap between two highlight ranges should be swallowed
 * into a single merged range — pure whitespace, a hyphen, or a short
 * Romanian clitic contraction (e.g. "m-a", "te-a", "ne-am", "s-a", "n-am").
 * Plain words like "a" or "este" between two matches stay un-merged so we
 * don't blob everything together.
 */
function isMergeableGap(gap: string): boolean {
  const trimmed = gap.trim()
  if (trimmed === '') return true
  return (
    trimmed.length <= 6 && trimmed.includes('-') && /^[\p{L}-]+$/u.test(trimmed)
  )
}

function mergeRanges(text: string, ranges: TextRange[]): TextRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: TextRange[] = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else if (last && isMergeableGap(text.slice(last.end, range.start))) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

/** The other spellings of one query word, beyond its own joined form. */
function spellingVariants(word: string): string[] {
  return [...joinedWordVariants(word), ...elisionVariants(word)]
}

/**
 * A hyphen word whose second piece elides "î" may be written as two words
 * with the vowel kept: "să-nfăptuiesc" → "să înfăptuiesc". Folded: "sa
 * infaptuiesc". Only meaningful as a phrase, so only the highlighter uses it.
 */
function spacedElisionForm(word: string): string | null {
  const parts = word.split(JOINER_SPLIT_RE).filter((part) => part.length > 0)
  const at = parts.findIndex(
    (part, index) => index > 0 && /^n[^aeiou]/u.test(part),
  )
  if (at === -1) return null
  return `${parts.slice(0, at).join('')} i${parts.slice(at).join('')}`
}

/** Every spelling of one query word that should light up the same text. */
function wordAlternatives(word: string): string[] {
  const joined = word.replace(JOINER_SPLIT_RE, '')
  const alternatives = new Set<string>([joined, ...spellingVariants(word)])
  const spaced = spacedElisionForm(word)
  if (spaced) alternatives.add(spaced)
  alternatives.delete('')
  return Array.from(alternatives)
}

/**
 * The literal user query as a substring of the diacritic-folded text.
 * removeDiacritics + toLowerCase preserve character count for the Romanian
 * alphabet, so positions map 1:1 back to the original.
 */
function findLiteralPhrase(text: string, rawQuery: string): TextRange | null {
  const cleaned = cleanQueryForHighlight(rawQuery)
  if (cleaned.length === 0) return null
  const pos = removeDiacritics(text).toLowerCase().indexOf(cleaned)
  if (pos === -1) return null
  return { start: pos, end: pos + cleaned.length }
}

/**
 * The whole query as a phrase in the joiner-dropped fold, each word in any
 * of its spellings — so "ne-ncetat" lands on "ne'ncetat", "nencetat" and
 * "neîncetat" alike, and the mark covers the whole word including the
 * hyphen or apostrophe.
 */
function findFoldedPhrase(text: string, rawQuery: string): TextRange | null {
  const words = cleanQueryForHighlight(rawQuery)
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((word) => word.length > 0)
  if (words.length === 0) return null

  const folded = foldText(text, { dropJoiners: true })
  const pattern = words
    .map((word) => `(?:${wordAlternatives(word).map(escapeRegExp).join('|')})`)
    .join(' ')
  const match = new RegExp(pattern, 'u').exec(folded.folded)
  if (!match || match[0].length === 0) return null
  return {
    start: folded.starts[match.index],
    end: folded.ends[match.index + match[0].length - 1],
  }
}

/**
 * Finds the word containing a fuzzy substring match
 * Returns the full word that contains the matching substring
 */
function findFuzzyMatchWord(
  content: string,
  term: string,
): { word: string; index: number } | null {
  if (term.length < 5) return null

  const words = content.match(/[\p{L}\p{N}]+/gu) || []

  for (let len = Math.min(5, term.length - 1); len >= 4; len--) {
    for (let start = 1; start <= term.length - len; start++) {
      const sub = term.substring(start, start + len).toLowerCase()
      for (const word of words) {
        if (word.toLowerCase().includes(sub)) {
          const index = content.toLowerCase().indexOf(word.toLowerCase())
          return { word, index }
        }
      }
    }
  }

  return null
}

/**
 * Where the search terms appear in `text`, as ranges of the ORIGINAL string
 * (diacritics, entities and punctuation intact) ready to be wrapped in
 * <mark>. Title and snippet share this so they always agree.
 *
 * 1. The typed query as a literal substring — while typing, the mark grows
 *    one character at a time and matches exactly what was typed.
 * 2. The typed query as a phrase, punctuation-blind and across spellings.
 * 3. Per-term marks, merged across whitespace and clitic gaps.
 */
export function findHighlightRanges(
  text: string,
  terms: string[],
  options: FindHighlightRangesOptions = {},
): TextRange[] {
  const { rawQuery, fuzzy = false } = options

  if (rawQuery !== undefined && rawQuery.length > 0) {
    const literal = findLiteralPhrase(text, rawQuery)
    if (literal) return [literal]
    const phrase = findFoldedPhrase(text, rawQuery)
    if (phrase) return [phrase]
  }

  const ranges: TextRange[] = []

  // Plain terms in the joiner-preserving fold, so short terms stay
  // word-bounded ("am" marks "am" inside "m-am", not half the corpus).
  const kept = foldText(text, { dropJoiners: false })
  for (const term of terms) {
    const folded = removeDiacritics(term).toLowerCase().trim()
    if (folded.length === 0) continue
    const escaped = escapeRegExp(folded)
    const pattern =
      folded.length <= 2
        ? new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu')
        : new RegExp(escaped, 'gu')
    let match: RegExpExecArray | null
    while ((match = pattern.exec(kept.folded)) !== null) {
      if (match[0].length === 0) {
        pattern.lastIndex++
        continue
      }
      ranges.push({
        start: kept.starts[match.index],
        end: kept.ends[match.index + match[0].length - 1],
      })
    }
  }

  // The other spellings of each typed word, against the joiner-dropped fold
  // so the whole word — sign included — is marked: "ne-ncetat" lights up
  // "ne'ncetat" and "neîncetat", and "neîncetat" lights up "ne-ncetat".
  if (rawQuery !== undefined && rawQuery.length > 0) {
    const dropped = foldText(text, { dropJoiners: true })
    for (const word of cleanQueryForHighlight(rawQuery).split(/\s+/)) {
      for (const variant of spellingVariants(word)) {
        let pos = dropped.folded.indexOf(variant)
        while (pos !== -1) {
          ranges.push({
            start: dropped.starts[pos],
            end: dropped.ends[pos + variant.length - 1],
          })
          pos = dropped.folded.indexOf(variant, pos + 1)
        }
      }
    }
  }

  if (fuzzy) {
    for (const term of terms) {
      const found = findFuzzyMatchWord(text, term)
      if (found && !ranges.some((range) => range.start === found.index)) {
        ranges.push({
          start: found.index,
          end: found.index + found.word.length,
        })
      }
    }
  }

  if (ranges.length === 0) return []
  return mergeRanges(text, ranges)
}

/** Wraps each range in <mark>, leaving the rest of the text untouched. */
export function wrapRanges(text: string, ranges: TextRange[]): string {
  let out = ''
  let cursor = 0
  for (const range of ranges) {
    out += text.slice(cursor, range.start)
    out += `<mark>${text.slice(range.start, range.end)}</mark>`
    cursor = range.end
  }
  return out + text.slice(cursor)
}
