/**
 * Turns HTML entities ("&amp;", "&#039;") into the characters they stand for,
 * and nothing else: every "<" is escaped first, so no tag can form. The
 * DOMParser document is inert (no scripts, no loads) and only its text is
 * read. The leading <body> keeps the text's leading spaces, which the parser
 * drops before the body starts.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text
  const escaped = text.replace(/</g, '&lt;')
  const doc = new DOMParser().parseFromString(`<body>${escaped}`, 'text/html')
  return doc.body.textContent ?? ''
}
