const HTML_TAG = /<[^>]*>/g

/**
 * Removes every HTML tag from `html`, replacing each with `replacement`.
 *
 * Runs until nothing changes, so no removal can leave a new tag behind
 * (the safe form CodeQL's js/incomplete-multi-character-sanitization asks for).
 * Decode entities only after this: `&lt;b&gt;` is text the user typed.
 */
export function removeHtmlTags(html: string, replacement = ''): string {
  let previous: string
  let text = html
  do {
    previous = text
    text = text.replace(HTML_TAG, replacement)
  } while (text !== previous)
  return text
}
