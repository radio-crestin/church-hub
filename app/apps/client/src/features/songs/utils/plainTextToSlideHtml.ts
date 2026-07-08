/**
 * Escape characters that are significant in HTML so user-typed lyrics are stored
 * safely. Mirrors the escaping used by markdownToHtml in slidesMarkdown.ts.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Convert the plain text produced by the in-place slide editor (newline-separated
 * lines) back into the stored slide HTML format (one <p> per line). This is the
 * inverse of normalizeText, so a round-trip through the editor preserves blank
 * lines and line breaks.
 */
export function plainTextToSlideHtml(text: string): string {
  const html = text
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
  return html || '<p></p>'
}
