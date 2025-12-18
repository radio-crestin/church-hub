import { useEffect, useRef } from 'react'

import type { BiblePassageVerse } from '../types'

interface QueueVersePreviewProps {
  verse: BiblePassageVerse
  verseIndex: number
  isActive: boolean
  onClick: () => void
}

// Find the nearest scrollable ancestor
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

// Scroll element into view within its scrollable container, keeping neighbors visible
function scrollIntoViewWithNeighbors(element: HTMLElement) {
  const scrollContainer = getScrollableParent(element)
  if (!scrollContainer) return

  const elementRect = element.getBoundingClientRect()
  const containerRect = scrollContainer.getBoundingClientRect()

  // Calculate element position relative to the scroll container
  const elementTop = elementRect.top - containerRect.top + scrollContainer.scrollTop
  const elementBottom = elementTop + elementRect.height

  // Get the visible area
  const visibleTop = scrollContainer.scrollTop
  const visibleBottom = visibleTop + scrollContainer.clientHeight

  // Add padding to ensure neighbors are visible (roughly one element height)
  const padding = elementRect.height * 1.5

  // Check if element is above visible area (with padding for previous neighbor)
  if (elementTop - padding < visibleTop) {
    scrollContainer.scrollTo({
      top: elementTop - padding,
      behavior: 'smooth',
    })
  }
  // Check if element is below visible area (with padding for next neighbor)
  else if (elementBottom + padding > visibleBottom) {
    scrollContainer.scrollTo({
      top: elementBottom + padding - scrollContainer.clientHeight,
      behavior: 'smooth',
    })
  }
}

export function QueueVersePreview({
  verse,
  verseIndex,
  isActive,
  onClick,
}: QueueVersePreviewProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Auto-scroll to keep active verse visible with neighbors
  useEffect(() => {
    if (isActive && buttonRef.current) {
      scrollIntoViewWithNeighbors(buttonRef.current)
    }
  }, [isActive])

  // Truncate verse text for preview
  const previewText =
    verse.text.length > 100 ? `${verse.text.slice(0, 100)}...` : verse.text

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className={`w-full text-left p-2 pl-10 rounded-lg border transition-all ${
        isActive
          ? 'border-teal-600 bg-teal-50 dark:bg-teal-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Verse Number */}
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
            isActive
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {verseIndex + 1}
        </div>

        {/* Verse Preview */}
        <div className="flex-1 min-w-0">
          <div
            className={`text-xs font-medium mb-0.5 ${
              isActive
                ? 'text-teal-700 dark:text-teal-300'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {verse.reference}
          </div>
          <div
            className={`text-sm line-clamp-2 ${
              isActive
                ? 'text-teal-900 dark:text-teal-100'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {previewText}
          </div>
        </div>
      </div>
    </button>
  )
}
