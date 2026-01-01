import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import type { SongSlide, SongWithSlides } from '../types'
import { expandSongSlidesWithChoruses } from '../utils/expandSongSlides'

interface SongSlidesPanelProps {
  song: SongWithSlides
  presentedSlideIndex: number | null
  isLoading: boolean
  onSlideClick: (slide: SongSlide, index: number) => void
}

const SCROLL_OFFSET_TOP = 100

/**
 * Decode HTML entities to their corresponding characters
 */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

/**
 * Strip HTML tags and extract plain text content
 */
function stripHtmlTags(html: string): string {
  // Replace </p><p> and <br> with newlines, then strip remaining tags
  const stripped = html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()

  return decodeHtmlEntities(stripped)
}

export function SongSlidesPanel({
  song,
  presentedSlideIndex,
  isLoading,
  onSlideClick,
}: SongSlidesPanelProps) {
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the presented slide
  useEffect(() => {
    if (highlightedRef.current && containerRef.current) {
      const container = containerRef.current
      const element = highlightedRef.current
      const elementRect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      const elementTop =
        elementRect.top - containerRect.top + container.scrollTop

      const targetScrollTop = Math.max(0, elementTop - SCROLL_OFFSET_TOP)

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      })
    }
  }, [presentedSlideIndex])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  // Expand slides with dynamic chorus insertion (V1 C1 V2 C1 V3 C2...)
  const expandedSlides = useMemo(
    () => expandSongSlidesWithChoruses(song.slides),
    [song.slides],
  )

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 space-y-1 overflow-hidden lg:overflow-y-auto px-0.5 py-0.5"
      >
        {expandedSlides.map((slide, index) => {
          const isPresented = index === presentedSlideIndex
          const slideNumber = index + 1

          const getButtonClass = () => {
            if (isPresented) {
              return 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
            }
            return 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }

          const getSlideNumberClass = () => {
            if (isPresented) {
              return 'text-green-700 dark:text-green-300'
            }
            return 'text-gray-500 dark:text-gray-400'
          }

          const getTextClass = () => {
            if (isPresented) {
              return 'text-green-900 dark:text-green-100'
            }
            return 'text-gray-700 dark:text-gray-200'
          }

          // Get full content for display (strip HTML tags and decode entities)
          const plainText = stripHtmlTags(slide.content)

          return (
            <button
              key={slide.id}
              ref={isPresented ? highlightedRef : null}
              type="button"
              onClick={() => !isPresented && onSlideClick(slide, index)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${getButtonClass()}`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`font-semibold text-sm min-w-[24px] ${getSlideNumberClass()}`}
                >
                  {slideNumber}
                </span>
                <span
                  className={`text-sm whitespace-pre-line ${getTextClass()}`}
                >
                  {plainText}
                </span>
              </div>
              {slide.label && (
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-8 mt-1 block">
                  {slide.label}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
