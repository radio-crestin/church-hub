/** Turns the entity escapes slide HTML carries back into their characters. */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
}

/**
 * Slide HTML as plain, line-broken text.
 *
 * Paragraph boundaries and `<br>` become newlines so the lyrics keep their
 * shape; everything else is dropped. Used wherever a slide has to be *read*
 * rather than presented — the slide list, the program items panel, and the
 * song preview in the add-to-program modal.
 */
export function stripHtmlTags(html: string): string {
  const stripped = html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
  return decodeHtmlEntities(stripped)
}
