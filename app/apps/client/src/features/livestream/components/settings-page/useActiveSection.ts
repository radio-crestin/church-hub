import { type RefObject, useEffect } from 'react'

/**
 * Marks the section card the operator is looking at (`data-active`): the last
 * of `content`'s cards whose top has passed the pane's upper quarter, or the
 * last one once scrolled to the end. Follows cards that appear later.
 */
export function useActiveSection(
  pane: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const scroller = pane.current
    const list = content.current
    if (!scroller || !list) return
    const update = () => {
      const cards = Array.from(list.children)
      const limit =
        scroller.getBoundingClientRect().top + scroller.clientHeight / 4
      let active = cards[0]
      for (const card of cards) {
        if (card.getBoundingClientRect().top <= limit) active = card
      }
      const scrollable = scroller.scrollHeight > scroller.clientHeight + 2
      if (
        scrollable &&
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
      ) {
        active = cards.at(-1) ?? active
      }
      for (const card of cards) {
        card.toggleAttribute('data-active', card === active)
      }
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(list, { childList: true })
    scroller.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', update)
    }
  }, [pane, content])
}
