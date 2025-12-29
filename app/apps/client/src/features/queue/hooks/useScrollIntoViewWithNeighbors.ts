import { type RefObject, useEffect } from 'react'

function getScrollableParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null

  let parent = element.parentElement
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent)
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

/**
 * Scrolls the container to keep neighbor items visible.
 *
 * Only scrolls when necessary:
 * - If the element is not visible, scrolls to show it with context
 * - If fewer than 2 items worth of space below, scrolls down by one element
 * - If element is too close to top (less than 1 element), scrolls up by one element
 *
 * This creates a smoother experience by only adjusting scroll position incrementally
 * rather than jumping to a fixed position every time.
 */
function scrollToKeepNeighborsVisible(element: HTMLElement) {
  const scrollContainer = getScrollableParent(element)
  if (!scrollContainer) return

  const elementRect = element.getBoundingClientRect()
  const containerRect = scrollContainer.getBoundingClientRect()
  const elementHeight = elementRect.height
  const maxScrollTop =
    scrollContainer.scrollHeight - scrollContainer.clientHeight

  // Check if element is fully hidden (not visible at all)
  const isFullyAboveViewport = elementRect.bottom <= containerRect.top
  const isFullyBelowViewport = elementRect.top >= containerRect.bottom

  if (isFullyAboveViewport || isFullyBelowViewport) {
    // Element not visible - scroll to show it with one element of context above
    const elementTopInContainer =
      elementRect.top - containerRect.top + scrollContainer.scrollTop
    const targetScrollTop = elementTopInContainer - elementHeight

    scrollContainer.scrollTo({
      top: Math.max(0, Math.min(maxScrollTop, targetScrollTop)),
      behavior: 'smooth',
    })
    return
  }

  // Element is at least partially visible - check if we need to adjust
  const spaceAbove = elementRect.top - containerRect.top
  const spaceBelow = containerRect.bottom - elementRect.bottom

  // Want at least 2 elements worth of space below (for next items)
  const minSpaceBelow = elementHeight * 2
  // Want at least 1 element worth of space above (for previous item)
  const minSpaceAbove = elementHeight

  // If not enough space below and we can scroll further, scroll down by one element
  if (
    spaceBelow < minSpaceBelow &&
    scrollContainer.scrollTop < maxScrollTop - 5
  ) {
    scrollContainer.scrollTo({
      top: Math.min(maxScrollTop, scrollContainer.scrollTop + elementHeight),
      behavior: 'smooth',
    })
    return
  }

  // If not enough space above and we can scroll up, scroll up by one element
  if (spaceAbove < minSpaceAbove && scrollContainer.scrollTop > 5) {
    scrollContainer.scrollTo({
      top: Math.max(0, scrollContainer.scrollTop - elementHeight),
      behavior: 'smooth',
    })
  }
}

export function useScrollIntoViewWithNeighbors(
  ref: RefObject<HTMLElement | null>,
  isActive: boolean,
) {
  useEffect(() => {
    if (isActive && ref.current) {
      scrollToKeepNeighborsVisible(ref.current)
    }
  }, [isActive, ref])
}
