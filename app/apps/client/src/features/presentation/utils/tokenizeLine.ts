/**
 * How finely a text is cut for a slide change to animate its parts:
 * - `words`: words and the spaces between them, punctuation staying on its
 *   word ("Doamne!" is one word);
 * - `reference`: like words, but digit runs and the `:` `-` `–` `,` of a Bible
 *   reference stand on their own, so "Ioan 3:16-18" is `Ioan`, ` `, `3`, `:`,
 *   `16`, `-`, `18` and a verse change touches only its number.
 */
export type TokenMode = 'words' | 'reference'

const PATTERNS: Record<TokenMode, RegExp> = {
  words: /\s+|\S+/g,
  reference: /\s+|\d+|[:\-–,]|[^\s\d:\-–,]+/g,
}

/** Cuts a line into its parts (see TokenMode). Joined back, they are the line. */
export function tokenizeLine(
  line: string,
  mode: TokenMode = 'words',
): string[] {
  return line.match(PATTERNS[mode]) ?? []
}
