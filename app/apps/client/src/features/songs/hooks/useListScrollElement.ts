import { type RefObject, useLayoutEffect, useState } from 'react'

interface ListScrollElement {
  /** The element that really scrolls the list. */
  element: HTMLElement | null
  /** Where the list starts inside that element's content (0 for its own box). */
  offset: number
}

function scrollingAncestor(list: HTMLElement): HTMLElement | null {
  for (let el = list.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY === 'auto' || overflowY === 'scroll') return el
  }
  return null
}

/**
 * The element a virtualized list scrolls in. Below `lg` pages scroll as a
 * whole (`Page`), so the list's own box grows as tall as its rows and never
 * scrolls: then the page's scroller is used, with the list's offset in it.
 * Otherwise (a bounded box, as on desktop) the list's own box.
 */
export function useListScrollElement(
  listRef: RefObject<HTMLElement | null>,
): ListScrollElement {
  const [state, setState] = useState<ListScrollElement>({
    element: null,
    offset: 0,
  })

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const ancestor = scrollingAncestor(list)
      const unbounded =
        ancestor !== null && list.clientHeight > ancestor.clientHeight
      const element = unbounded ? ancestor : list
      const offset = unbounded
        ? list.getBoundingClientRect().top -
          ancestor.getBoundingClientRect().top +
          ancestor.scrollTop
        : 0
      setState((prev) =>
        prev.element === element && prev.offset === offset
          ? prev
          : { element, offset },
      )
    }
    measure()
    // The list and every box up to the scroller: content above the list
    // (filters, a header) growing moves the list's offset.
    const observer = new ResizeObserver(measure)
    const ancestor = scrollingAncestor(list)
    for (
      let el: HTMLElement | null = list;
      el && el !== ancestor;
      el = el.parentElement
    ) {
      observer.observe(el)
    }
    return () => observer.disconnect()
  }, [listRef])

  return state
}
