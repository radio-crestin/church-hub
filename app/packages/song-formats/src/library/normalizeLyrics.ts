import { decodeHtmlEntities } from '../decodeHtmlEntities'

/**
 * Lyrics as the fingerprint sees them: tags dropped, entities decoded,
 * diacritics removed (ș ş s alike), lower case, only letters and digits,
 * single spaces. A block repeated (a chorus sung twice) counts once, so the
 * order of the first appearances is all that matters.
 */
export function normalizeLyrics(blocks: string[]): string {
  const seen = new Set<string>()
  for (const block of blocks) {
    const text = decodeHtmlEntities(block.replace(/<[^>]*>/g, ' '))
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
    if (text) seen.add(text)
  }
  return [...seen].join(' ')
}
