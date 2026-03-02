import { Check, Loader2, Pencil, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { SongSlide, SongWithSlides } from '../types'
import { expandSongSlidesWithChoruses } from '../utils/expandSongSlides'

interface SongSlidesPanelProps {
  song: SongWithSlides
  presentedSlideIndex: number | null
  selectedSlideIndex: number
  isLoading: boolean
  onSlideClick: (slide: SongSlide, index: number) => void
  onSlideEdit?: (slideId: number, content: string) => Promise<void>
}

const SCROLL_OFFSET_TOP = 100

/**
 * Decode HTML entities to their corresponding characters.
 * Uses a temporary textarea element which safely decodes entities
 * via the browser's built-in HTML parser (textContent, not innerHTML).
 */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.textContent = text
  // Read the decoded value - textarea handles entity decoding safely
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

/**
 * Convert plain text back to HTML paragraphs.
 * Each line becomes a <p> element. Empty lines use <br> placeholder.
 * Content is escaped to prevent XSS.
 */
function plainTextToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      // Escape HTML special characters to prevent XSS
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      return `<p>${escaped || '<br>'}</p>`
    })
    .join('')
}

export function SongSlidesPanel({
  song,
  presentedSlideIndex,
  selectedSlideIndex,
  isLoading,
  onSlideClick,
  onSlideEdit,
}: SongSlidesPanelProps) {
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [editingSlideId, setEditingSlideId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Auto-scroll to the selected slide (when not presented)
  useEffect(() => {
    if (
      presentedSlideIndex === null &&
      selectedRef.current &&
      containerRef.current
    ) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [selectedSlideIndex, presentedSlideIndex])

  // Focus textarea when editing starts
  useEffect(() => {
    if (editingSlideId !== null && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [editingSlideId])

  const handleStartEdit = useCallback(
    (slide: SongSlide, e: React.MouseEvent) => {
      e.stopPropagation()
      setEditingSlideId(slide.id)
      setEditContent(stripHtmlTags(slide.content))
    },
    [],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingSlideId(null)
    setEditContent('')
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingSlideId || !onSlideEdit) return
    setIsSaving(true)
    try {
      await onSlideEdit(editingSlideId, plainTextToHtml(editContent))
      setEditingSlideId(null)
      setEditContent('')
    } finally {
      setIsSaving(false)
    }
  }, [editingSlideId, editContent, onSlideEdit])

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
          const isSelected =
            index === selectedSlideIndex && presentedSlideIndex === null
          const slideNumber = index + 1
          const isEditing = editingSlideId === slide.id

          const getButtonClass = () => {
            if (isPresented) {
              return 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
            }
            if (isSelected) {
              return 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500'
            }
            return 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }

          const getSlideNumberClass = () => {
            if (isPresented) {
              return 'text-green-700 dark:text-green-300'
            }
            if (isSelected) {
              return 'text-indigo-700 dark:text-indigo-300'
            }
            return 'text-gray-500 dark:text-gray-400'
          }

          const getTextClass = () => {
            if (isPresented) {
              return 'text-green-900 dark:text-green-100'
            }
            if (isSelected) {
              return 'text-indigo-900 dark:text-indigo-100'
            }
            return 'text-gray-700 dark:text-gray-200'
          }

          // Determine which ref to use
          const getRef = () => {
            if (isPresented) return highlightedRef
            if (isSelected) return selectedRef
            return null
          }

          // Get full content for display (strip HTML tags and decode entities)
          const plainText = stripHtmlTags(slide.content)

          if (isEditing) {
            return (
              <div
                key={slide.id}
                className="w-full px-3 py-2 rounded-lg ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
              >
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-sm min-w-[24px] text-indigo-700 dark:text-indigo-300">
                    {slideNumber}
                  </span>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <textarea
                      ref={textareaRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCancelEdit()
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey))
                          handleSaveEdit()
                      }}
                      rows={Math.max(3, editContent.split('\n').length)}
                      className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono"
                    />
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="p-1 rounded text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="p-1 rounded text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Check size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <button
              key={slide.id}
              ref={getRef()}
              type="button"
              onClick={() => !isPresented && onSlideClick(slide, index)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors group ${getButtonClass()}`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`font-semibold text-sm min-w-[24px] ${getSlideNumberClass()}`}
                >
                  {slideNumber}
                </span>
                <span
                  className={`text-sm whitespace-pre-line flex-1 ${getTextClass()}`}
                >
                  {plainText}
                </span>
                {onSlideEdit && (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => handleStartEdit(slide, e)}
                    onKeyDown={() => {}}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all shrink-0"
                  >
                    <Pencil size={12} />
                  </span>
                )}
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
