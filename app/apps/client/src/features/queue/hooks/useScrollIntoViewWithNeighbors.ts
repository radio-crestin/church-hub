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
 * Scrolls the element to the "second position" from the top of the container.
 * This means there will be approximately one element's worth of space above
 * the active element, allowing the user to see context above and below.
 *
 * Edge cases:
 * - First item: Scrolls to top (can't show item above)
 * - Near end: Scrolls as far as possible if container can't scroll further
 */
function scrollToSecondPosition(element: HTMLElement) {
  const scrollContainer = getScrollableParent(element)
  if (!scrollContainer) return

  const elementRect = element.getBoundingClientRect()
  const containerRect = scrollContainer.getBoundingClientRect()

  // Calculate element's position relative to the container's scroll position
  const elementTopInContainer =
    elementRect.top - containerRect.top + scrollContainer.scrollTop

  // Target position: element should be one element height from the top
  // This puts it in the "second position" visually
  const targetOffset = elementRect.height

  // Calculate the ideal scroll position to put element in second position
  const idealScrollTop = elementTopInContainer - targetOffset

  // Clamp to valid scroll range
  const maxScrollTop =
    scrollContainer.scrollHeight - scrollContainer.clientHeight
  const clampedScrollTop = Math.max(0, Math.min(idealScrollTop, maxScrollTop))

  // Calculate where the element currently appears relative to the container viewport
  const currentElementVisualTop = elementRect.top - containerRect.top

  // Check if element is already very close to the target position (within 5px)
  // to avoid unnecessary scrolling/jittering
  const tolerance = 5
  const isAlreadyAtTarget =
    Math.abs(currentElementVisualTop - targetOffset) < tolerance

  if (!isAlreadyAtTarget) {
    scrollContainer.scrollTo({
      top: clampedScrollTop,
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
      scrollToSecondPosition(ref.current)
    }
  }, [isActive, ref])
}
