/**
 * True for an element that is drawn entirely outside the viewport, such as
 * list rows scrolled out of view. Leaving those out keeps the screenshot
 * fast on long lists (thousands of songs). Zero-size boxes (e.g.
 * `display: contents`) are kept, since their children may be visible.
 */
export function isOutsideViewport(node: Node): boolean {
  if (!(node instanceof Element)) return false
  const rect = node.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  return (
    rect.bottom < 0 ||
    rect.right < 0 ||
    rect.top > window.innerHeight ||
    rect.left > window.innerWidth
  )
}
