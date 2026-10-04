const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  apos: "'",
  nbsp: ' ',
}

const ENTITY = /&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-z]+));/g

/**
 * Turns the entity escapes slide HTML carries back into their characters.
 *
 * One pass over the text, so a decoded `&` never starts a new entity:
 * `&amp;lt;` becomes the literal text `&lt;`, not `<`. Unknown entities stay
 * as they are.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(ENTITY, (entity, decimal, hex, name) => {
    if (decimal) return String.fromCharCode(Number(decimal))
    if (hex) return String.fromCharCode(Number.parseInt(hex, 16))
    return NAMED_ENTITIES[name] ?? entity
  })
}
