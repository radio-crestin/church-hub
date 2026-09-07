/**
 * Rewrites the characters on the slide canvas in place.
 *
 * The editor deliberately does not re-seed itself when the slide's text changes
 * while the same slide is open — that is what keeps the caret still while the
 * operator types. A change made from the formatting bar therefore has to reach
 * the canvas itself, and re-seeding it would throw away both the styled markup
 * and the selection the operator is working on.
 *
 * Only the text nodes' data is replaced, and only when the new text is exactly
 * as long as the old one, so every element stays where it is: the styled runs
 * keep their words, and the browser keeps the selection because the nodes
 * holding it are the same nodes with the same lengths.
 *
 * Returns false — and leaves the canvas untouched — when the text does not line
 * up, in which case the slide draft is still updated and the canvas catches up
 * the next time it is seeded.
 */
export function writeSlideText(next: string): boolean {
  const editor = document.querySelector<HTMLElement>(
    '[data-testid="slide-canvas-editable"]',
  )
  if (!editor) return false

  const walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  )
  const writes: Array<{ node: Text; data: string }> = []
  let seen = 0
  let node: Node | null = walker.nextNode()

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text
      const slice = next.slice(seen, seen + text.data.length)
      if (slice.length !== text.data.length) return false
      if (text.data !== slice) writes.push({ node: text, data: slice })
      seen += text.data.length
    } else if (node.nodeName === 'BR') {
      seen += 1
    }
    node = walker.nextNode()
  }

  if (seen !== next.length) return false
  for (const write of writes) write.node.data = write.data
  return true
}
