const HTML_SPECIAL_RE = /[&<>"']/g
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Text made safe to place inside HTML: every markup character escaped. */
export function escapeHtml(text: string): string {
  return text.replace(HTML_SPECIAL_RE, (char) => ESCAPES[char])
}
