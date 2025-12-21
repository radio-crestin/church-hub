import { useEffect, type RefObject } from 'react'

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

function scrollIntoViewWithNeighbors(element: HTMLElement) {
  const scrollContainer = getScrollableParent(element)
  if (!scrollContainer) return

  const elementRect = element.getBoundingClientRect()
  const containerRect = scrollContainer.getBoundingClientRect()

  const elementTop =
    elementRect.top - containerRect.top + scrollContainer.scrollTop
  const elementBottom = elementTop + elementRect.height

  const visibleTop = scrollContainer.scrollTop
  const visibleBottom = visibleTop + scrollContainer.clientHeight

  const padding = elementRect.height * 1.5

  if (elementTop - padding < visibleTop) {
    scrollContainer.scrollTo({
      top: elementTop - padding,
      behavior: 'smooth',
    })
  } else if (elementBottom + padding > visibleBottom) {
    scrollContainer.scrollTo({
      top: elementBottom + padding - scrollContainer.clientHeight,
      behavior: 'smooth',
    })
  }
}

export function useScrollIntoViewWithNeighbors(
  ref: RefObject<HTMLElement | null>,
  isActive: boolean
) {
  useEffect(() => {
    if (isActive && ref.current) {
      scrollIntoViewWithNeighbors(ref.current)
    }
  }, [isActive, ref])
}
