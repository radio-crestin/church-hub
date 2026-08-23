/**
 * Characters that glue two word pieces together inside one Romanian word:
 * the hyphen family and the apostrophe family. "ne-ncetat", "ne'ncetat" and
 * "ne’ncetat" are all the same word as "nencetat" (and, with the elided "î"
 * restored, "neîncetat").
 */
export const WORD_JOINERS =
  "\\-\u2010\u2011\u2012\u2013\u2014'\u2019\u2018\u02BC`\u00B4"
const JOINER_RE = new RegExp(`[${WORD_JOINERS}]+`, 'u')
const OUTER_PUNCT_RE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

/**
 * The joined spellings of a word written with a hyphen or apostrophe, so
 * every way the same word is written in a songbook finds the others:
 *
 *   "ne-ncetat"  → ["nencetat", "neincetat"]
 *   "te-asteptam" → ["teasteptam"]
 *   "s-a"         → ["sa"]
 *
 * A piece that starts with "n" + consonant is the elided "în…" ("ne-ncetat"
 * is "ne încetat"), so that spelling is produced too. Input is expected to
 * be diacritic-free and lowercase; plain words yield nothing, and neither do
 * the shortest clitic contractions ("m-a", "s-a", "n-am") — joined, those
 * are just other common words ("ma", "sa") and would only add noise.
 */
export function joinedWordVariants(word: string): string[] {
  const core = word.replace(OUTER_PUNCT_RE, '')
  const parts = core.split(JOINER_RE).filter((part) => part.length > 0)
  if (parts.length < 2) return []
  if (!parts.every((part) => /^[\p{L}\p{N}]+$/u.test(part))) return []
  if (parts.join('').length < 4) return []

  const variants = new Set<string>()
  variants.add(parts.join(''))

  const withElidedI = parts.map((part, index) =>
    index > 0 && /^n[^aeiou]/iu.test(part) ? `i${part}` : part,
  )
  variants.add(withElidedI.join(''))

  return Array.from(variants)
}
