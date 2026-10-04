const XML_TAG = /<[^>]+>/g

/**
 * Removes every XML/HTML tag (opening, closing and self-closing) from `text`.
 *
 * Runs until nothing changes, so no removal can leave a new tag behind
 * (the safe form CodeQL's js/incomplete-multi-character-sanitization asks for).
 */
export function removeXmlTags(text: string): string {
  let previous: string
  let cleaned = text
  do {
    previous = cleaned
    cleaned = cleaned.replace(XML_TAG, '')
  } while (cleaned !== previous)
  return cleaned
}
