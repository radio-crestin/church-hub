/** Characters that would otherwise start or end a style. */
const INLINE_SPECIALS = /[\\*_=<`]/g

/** Characters that would turn a line into a heading or a quote. */
const LINE_START_SPECIALS = /^(\s*)([#>])/gm

/**
 * Backslash-escapes the text so it reads back as the same plain text, in any
 * CommonMark reader and in `parseStyledMarkdown`.
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(INLINE_SPECIALS, (char) => `\\${char}`)
    .replace(LINE_START_SPECIALS, '$1\\$2')
}
