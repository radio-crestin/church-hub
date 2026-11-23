/**
 * The element that actually scrolls `el` into view: `el` itself when its
 * content overflows it (the verse list's own scroll box on a desktop), else
 * its nearest scrolling ancestor (on a phone the list grows with its verses
 * and the page scrolls instead).
 */
export function getScrollContainer(el: HTMLElement): HTMLElement {
  if (el.scrollHeight > el.clientHeight + 1) return el
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node
    }
  }
  return (document.scrollingElement as HTMLElement | null) ?? el
}
