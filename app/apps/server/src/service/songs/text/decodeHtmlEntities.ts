const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

const ENTITY_SOURCE = '&(#x[0-9a-f]+|#\\d+|amp|lt|gt|quot|apos|nbsp);'
export const HTML_ENTITY_RE = new RegExp(ENTITY_SOURCE, 'giu')
/** Matches an entity only at the very start of the string it is run on. */
export const LEADING_HTML_ENTITY_RE = new RegExp(`^${ENTITY_SOURCE}`, 'iu')

/** Decodes one entity match (e.g. `&#039;`, `&amp;`) to its character. */
export function decodeHtmlEntity(entity: string): string {
  const body = entity.slice(1, -1).toLowerCase()
  if (body.startsWith('#x')) {
    return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
  }
  if (body.startsWith('#')) {
    return String.fromCodePoint(Number.parseInt(body.slice(1), 10))
  }
  return NAMED[body] ?? entity
}

/**
 * Slide content is stored HTML-escaped, so an apostrophe arrives as
 * `&#039;`. Left as-is it tokenises into a stray "039" that splits phrases
 * ("ne&#039;ncetat" → "ne 039 ncetat"); decode before normalising.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(HTML_ENTITY_RE, (entity) => decodeHtmlEntity(entity))
}
