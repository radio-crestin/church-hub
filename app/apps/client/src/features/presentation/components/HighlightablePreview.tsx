import { Eraser, Settings2, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { HighlightColorManager } from './editor/HighlightColorManager'
import { useHighlightColors } from '../hooks/useHighlightColors'
import {
  useClearLiveHighlights,
  useUpdateLiveHighlights,
} from '../hooks/usePresentationControls'
import { usePresentationState } from '../hooks/usePresentationState'
import type { LiveHighlight } from '../types'

interface HighlightablePreviewProps {
  children: React.ReactNode
  /** Text content that is being displayed (used to calculate offsets) */
  textContent: string
  /** Whether highlighting is enabled */
  enabled?: boolean
}

interface SelectionInfo {
  startOffset: number
  endOffset: number
  rect: DOMRect
}

/**
 * Wrapper component that enables live text highlighting on previews.
 * When text is selected, shows a color picker popup.
 * Highlights are stored in-memory and broadcast via WebSocket.
 */
export function HighlightablePreview({
  children,
  textContent,
  enabled = true,
}: HighlightablePreviewProps) {
  const { t } = useTranslation('presentation')
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [isColorManagerOpen, setIsColorManagerOpen] = useState(false)
  const [hoveredColor, setHoveredColor] = useState<string | null>(null)

  const { data: colors = [] } = useHighlightColors()
  const { data: presentationState } = usePresentationState()
  const updateHighlights = useUpdateLiveHighlights()
  const clearHighlights = useClearLiveHighlights()

  const currentHighlights = presentationState?.liveHighlights ?? []

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    if (!enabled) return

    const windowSelection = window.getSelection()
    if (!windowSelection || windowSelection.isCollapsed) {
      setSelection(null)
      return
    }

    const selectedText = windowSelection.toString().trim()
    if (!selectedText) {
      setSelection(null)
      return
    }

    // Check if selection is within our container
    const range = windowSelection.getRangeAt(0)
    if (!containerRef.current?.contains(range.commonAncestorContainer)) {
      setSelection(null)
      return
    }

    // Find the offset in the text content
    const startOffset = textContent.indexOf(selectedText)
    if (startOffset === -1) {
      setSelection(null)
      return
    }

    const endOffset = startOffset + selectedText.length
    const rect = range.getBoundingClientRect()

    setSelection({ startOffset, endOffset, rect })
  }, [enabled, textContent])

  // Close selection popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selection && popupRef.current) {
        const target = e.target as Node
        if (!popupRef.current.contains(target)) {
          setSelection(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selection])

  // Apply a highlight color
  const handleColorClick = useCallback(
    (color: string, textColor?: string) => {
      if (!selection) return

      // Clear selection FIRST to avoid stale DOM references
      try {
        window.getSelection()?.removeAllRanges()
      } catch {
        // Selection may reference removed nodes
      }

      const newHighlight: LiveHighlight = {
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        color,
        textColor,
      }

      // Merge with existing highlights (avoid overlaps by replacing)
      const filteredHighlights = currentHighlights.filter(
        (h) =>
          h.endOffset <= selection.startOffset ||
          h.startOffset >= selection.endOffset,
      )

      updateHighlights.mutate([...filteredHighlights, newHighlight])
      setSelection(null)
    },
    [selection, currentHighlights, updateHighlights],
  )

  // Remove a specific highlight (when clicking on already highlighted text)
  const handleRemoveHighlight = useCallback(() => {
    if (!selection) return

    // Clear selection FIRST to avoid stale DOM references
    try {
      window.getSelection()?.removeAllRanges()
    } catch {
      // Selection may reference removed nodes
    }

    const filteredHighlights = currentHighlights.filter(
      (h) =>
        h.endOffset <= selection.startOffset ||
        h.startOffset >= selection.endOffset,
    )

    updateHighlights.mutate(filteredHighlights)
    setSelection(null)
  }, [selection, currentHighlights, updateHighlights])

  // Check if current selection overlaps with existing highlights
  const hasExistingHighlight =
    selection &&
    currentHighlights.some(
      (h) =>
        h.startOffset < selection.endOffset &&
        h.endOffset > selection.startOffset,
    )

  // Calculate popup position
  const popupStyle: React.CSSProperties | undefined = selection
    ? {
        position: 'fixed',
        left: selection.rect.left + selection.rect.width / 2,
        top: selection.rect.top - 60,
        transform: 'translateX(-50%)',
        zIndex: 1000,
      }
    : undefined

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="relative w-full h-full"
      style={{ userSelect: enabled ? 'text' : 'none' }}
    >
      {children}

      {/* Highlight color popup */}
      {selection && (
        <div
          ref={popupRef}
          style={popupStyle}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Arrow pointer */}
          <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 rotate-45 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700" />

          <div className="relative flex items-center gap-1.5">
            {/* Color swatches */}
            {colors.length > 0 ? (
              colors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => handleColorClick(color.color, color.textColor)}
                  onMouseEnter={() => setHoveredColor(color.id.toString())}
                  onMouseLeave={() => setHoveredColor(null)}
                  className="relative w-8 h-8 rounded-xl border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-500 hover:scale-110 transition-all duration-150 flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: color.color }}
                  title={color.name}
                >
                  <span
                    className="text-[10px] font-bold opacity-70"
                    style={{ color: color.textColor || '#000000' }}
                  >
                    A
                  </span>
                  {hoveredColor === color.id.toString() && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap">
                      {color.name}
                    </div>
                  )}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelection(null)
                  setIsColorManagerOpen(true)
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              >
                <Sparkles size={14} />
                <span>{t('highlight.addColors', 'Add colors')}</span>
              </button>
            )}

            {/* Divider */}
            {colors.length > 0 && (
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5" />
            )}

            {/* Remove highlight button */}
            {hasExistingHighlight && (
              <button
                type="button"
                onClick={handleRemoveHighlight}
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all duration-150"
                title={t('highlight.removeHighlight', 'Remove Highlight')}
              >
                <Eraser className="w-4 h-4" />
              </button>
            )}

            {/* Manage colors button */}
            {colors.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelection(null)
                  setIsColorManagerOpen(true)
                }}
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-150"
                title={t('highlight.manageColors', 'Manage Colors')}
              >
                <Settings2 className="w-4 h-4" />
              </button>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-150"
              title={t('common.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Clear all highlights button */}
      {currentHighlights.length > 0 && (
        <button
          type="button"
          onClick={() => {
            // Clear any active text selection first to prevent DOM conflicts
            try {
              window.getSelection()?.removeAllRanges()
            } catch {
              // Selection may reference removed nodes
            }
            clearHighlights.mutate()
          }}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900/80 dark:bg-gray-800/90 text-white rounded-full hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors backdrop-blur-sm shadow-lg"
          title={t('highlight.clearAll', 'Clear All Highlights')}
        >
          <Eraser className="w-3 h-3" />
          {t('highlight.clearAll', 'Clear All')}
        </button>
      )}

      {/* Highlight Color Manager Modal */}
      <HighlightColorManager
        isOpen={isColorManagerOpen}
        onClose={() => setIsColorManagerOpen(false)}
      />
    </div>
  )
}
