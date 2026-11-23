/**
 * Removes every HTML tag (`<` up to the next `>`) from `html`, replacing each
 * with `replacement`.
 *
 * A scan rather than a regex: linear on any input (`<<<<…` with no `>` made
 * `/<[^>]*>/g` quadratic), and one pass is complete, since the text it keeps
 * between tags has no `<` that could start a new one. An unclosed `<` and
 * what follows it stay as text, as before.
 * Decode entities only after this: `&lt;b&gt;` is text the user typed.
 */
export function removeHtmlTags(html: string, replacement = ''): string {
  let text = ''
  let index = 0
  while (index < html.length) {
    const open = html.indexOf('<', index)
    if (open === -1) break
    const close = html.indexOf('>', open)
    if (close === -1) break
    text += html.slice(index, open) + replacement
    index = close + 1
  }
  return text + html.slice(index)
}
