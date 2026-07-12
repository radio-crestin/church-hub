/**
 * Cleans text pasted into the slide editor so it keeps the copied form without
 * dragging in the invisible artifacts a rich (HTML) paste normally leaves
 * between verses: Windows line endings, non-breaking spaces, trailing
 * spaces/tabs, runs of blank lines, and leading/trailing blank lines.
 *
 * It deliberately leaves the visible content of each line untouched (including
 * leading indentation and internal spacing) so intentional formatting survives.
 */
export function sanitizePastedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n') // Windows/old-Mac line endings → \n
    .replace(/ /g, ' ') // non-breaking spaces → normal spaces
    .replace(/[ \t]+$/gm, '') // trailing spaces/tabs (also empties whitespace-only lines)
    .replace(/\n{3,}/g, '\n\n') // collapse runs of blank lines to at most one
    .replace(/^\n+|\n+$/g, '') // drop leading/trailing blank lines
}
