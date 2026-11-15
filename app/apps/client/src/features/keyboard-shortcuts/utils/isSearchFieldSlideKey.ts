/** The keys that move the live slide and have no use in a one-line field. */
const SLIDE_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'])

/**
 * Whether a key pressed in a search field still belongs to slide navigation:
 * Up/Down or a presenter remote's page key, pressed in a one-line field that
 * opts in with a `data-slide-navigation` attribute, and that the field's own
 * handler left alone (a results list it walks calls preventDefault first).
 *
 * The operator keeps the search focused to find what comes next while a slide
 * is live; Down must still move that slide on. Left/Right, Space, Enter and
 * letters stay with the text, and so does a key with a modifier held.
 */
export function isSearchFieldSlideKey(event: KeyboardEvent): boolean {
  if (!SLIDE_KEYS.has(event.key) || event.defaultPrevented) return false
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return false
  }
  return (
    event.target instanceof HTMLInputElement &&
    event.target.closest('[data-slide-navigation]') !== null
  )
}
