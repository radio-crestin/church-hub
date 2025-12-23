import { Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { SongSlide, SongWithSlides } from '../types'

interface SongSlidesPanelProps {
  song: SongWithSlides
  presentedSlideIndex: number | null
  isLoading: boolean
  onSlideClick: (slide: SongSlide, index: number) => void
}

const SCROLL_OFFSET_TOP = 100

/**
 * Strip HTML tags and extract plain text content
 */
function stripHtmlTags(html: string): string {
  // Replace </p><p> and <br> with newlines, then strip remaining tags
  return html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
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

  const sortedSlides = [...song.slides].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 space-y-1 overflow-y-auto px-0.5 py-0.5"
      >
        {sortedSlides.map((slide, index) => {
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

          // Get first line or truncated content for preview (strip HTML tags)
          const plainText = stripHtmlTags(slide.content)
          const contentPreview = plainText
            .split('\n')
            .filter((line) => line.trim())
            .slice(0, 2)
            .join(' / ')

          return (
            <button
              key={slide.id}
              ref={isPresented ? highlightedRef : null}
              type="button"
              onClick={() => onSlideClick(slide, index)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${getButtonClass()}`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`font-semibold text-sm min-w-[24px] ${getSlideNumberClass()}`}
                >
                  {slideNumber}
                </span>
                <span className={`text-sm line-clamp-2 ${getTextClass()}`}>
                  {contentPreview}
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
