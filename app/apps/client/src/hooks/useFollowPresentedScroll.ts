import { useEffect } from 'react'

/**
 * The row that visually follows `element`, even across group boundaries.
 *
 * On the program page the last slide of a song is followed by the next item's
 * card, not by a sibling — so when there is no next sibling we climb until we
 * find one, stopping at the scroll container.
 */
function findAdjacentRow(
  element: HTMLElement,
  container: HTMLElement,
  direction: 'next' | 'previous',
): HTMLElement | null {
  const key =
    direction === 'next' ? 'nextElementSibling' : 'previousElementSibling'
  let node: HTMLElement | null = element
  while (node && node !== container) {
    const sibling = node[key] as HTMLElement | null
    if (sibling) return sibling
    node = node.parentElement
  }
  return null
}

/** Scrolls so the live row and the one after it are both on screen. */
function alignToPresented(
  container: HTMLElement,
  element: HTMLElement,
): boolean {
  const containerTop = container.getBoundingClientRect().top
  const viewportHeight = container.clientHeight
  /** Offset of an element's edge from the container's visible top. */
  const offsetTop = (el: HTMLElement) =>
    el.getBoundingClientRect().top - containerTop
  const offsetBottom = (el: HTMLElement) =>
    el.getBoundingClientRect().bottom - containerTop

  const previous = findAdjacentRow(element, container, 'previous')
  const next = findAdjacentRow(element, container, 'next')

  // Preferred: one row of context above the live one.
  let delta = offsetTop(previous ?? element)

  // Required: the next row has to be on screen too.
  if (next) {
    delta = Math.max(delta, offsetBottom(next) - viewportHeight)
  }

  // Inviolable: the live row's own top stays visible. Applied last, so a tall
  // live row keeps its top and the look-ahead gets whatever room is left.
  delta = Math.min(delta, offsetTop(element))

  const maxScrollTop = Math.max(0, container.scrollHeight - viewportHeight)
  const targetScrollTop = Math.min(
    Math.max(0, container.scrollTop + delta),
    maxScrollTop,
  )

  if (Math.abs(targetScrollTop - container.scrollTop) < 2) return false
  container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  return true
}

/**
 * Keeps the row that is on the projector in view, together with what comes
 * after it.
 *
 * Two things matter while running a service, in this order: seeing the live row
 * from its top, and seeing the NEXT one so you know what you are walking into.
 * So the scroll is chosen as a range rather than a single position — park the
 * previous row at the top for context, but scroll further if that would leave
 * the next row below the fold, and never so far that the live row's own top is
 * pushed off.
 *
 * The alignment runs more than once on purpose. Crossing from one program item
 * into the next collapses the item being left behind, which removes height
 * *above* the live row and yanks it upward — a layout shift that lands after
 * the first pass has already measured. Re-aligning until the geometry stops
 * moving is what keeps that from stranding the live row above the fold.
 *
 * Used by every list that follows the projection — the program items panel, the
 * Programe panel, the song slide rails, the live program item panel — so they
 * all move alike.
 *
 * @param containerRef The scrolling element.
 * @param targetRef The live row inside it.
 * @param key Re-runs the scroll whenever it changes (the live position).
 */
export function useFollowPresentedScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  targetRef: React.RefObject<HTMLElement | null>,
  key: unknown,
): void {
  useEffect(() => {
    // Deliberately NOT guarded on the refs being set yet. Crossing into another
    // program item collapses one item and expands another, so at the moment the
    // live position changes the new row has not mounted — bailing here would
    // skip the scroll entirely and never run again, because the key is already
    // current. The passes below re-read the refs when they fire.
    //
    // First pass waits for the auto-expand to reveal the row; the later passes
    // catch the collapse of the item we just left, and are no-ops otherwise.
    const timers = [100, 320, 600].map((delay) =>
      setTimeout(() => {
        const container = containerRef.current
        const element = targetRef.current
        if (!container || !element) return
        alignToPresented(container, element)
      }, delay),
    )

    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, containerRef, targetRef])
}
