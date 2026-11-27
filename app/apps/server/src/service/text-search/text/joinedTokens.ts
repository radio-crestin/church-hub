import { WORD_JOINERS } from './joinedWordVariants'

const JOINER_RE = new RegExp(`[${WORD_JOINERS}]`, 'gu')
const SPACE_RE = /\s/

/**
 * The whitespace-separated tokens of `text` written with a hyphen or an
 * apostrophe ("ne-ncetat,", "s-a"), in order. Found from the joiners, which
 * are rare, instead of by splitting the whole text into tokens: a song
 * library's lyrics hold millions of tokens and only a few joined ones.
 */
export function joinedTokens(text: string): string[] {
  const tokens: string[] = []
  let end = -1
  for (const { index } of text.matchAll(JOINER_RE)) {
    if (index < end) continue
    let start = index
    while (start > 0 && !SPACE_RE.test(text[start - 1] ?? '')) start--
    end = index + 1
    while (end < text.length && !SPACE_RE.test(text[end] ?? '')) end++
    tokens.push(text.slice(start, end))
  }
  return tokens
}
