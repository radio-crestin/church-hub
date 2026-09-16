/** What a presenter remote sends for "next slide" and "previous slide". */
const PAGE_KEYS = new Set(['PageDown', 'PageUp'])

/**
 * Whether a key pressed inside an editable element still belongs to slide
 * navigation: a presenter remote's page key, pressed in a slide editor that
 * opts in with a `data-slide-navigation` attribute.
 *
 * A slide box has nothing to page through, and pressing "next" there means the
 * edit is done. Every other key stays with the text — arrows, Space, Home/End
 * and letters move the caret or type — and so does a page key with a modifier
 * held, which extends a selection or scrolls.
 */
export function isSlideEditorPageKey(event: KeyboardEvent): boolean {
  if (!PAGE_KEYS.has(event.key)) return false
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return false
  }
  return (
    event.target instanceof Element &&
    event.target.closest('[data-slide-navigation]') !== null
  )
}
