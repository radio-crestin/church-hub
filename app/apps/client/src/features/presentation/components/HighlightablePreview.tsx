import { Settings2, X } from 'lucide-react'
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
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [isColorManagerOpen, setIsColorManagerOpen] = useState(false)

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
      if (selection && containerRef.current) {
        const target = e.target as Node
        // Check if click is outside the popup area
        const popup = document.getElementById('highlight-popup')
        if (popup && !popup.contains(target)) {
          setSelection(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selection])

  // Apply a highlight color
  const handleColorClick = useCallback(
    (color: string) => {
      if (!selection) return

      const newHighlight: LiveHighlight = {
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        color,
      }

      // Merge with existing highlights (avoid overlaps by replacing)
      const filteredHighlights = currentHighlights.filter(
        (h) =>
          h.endOffset <= selection.startOffset ||
          h.startOffset >= selection.endOffset,
      )

      updateHighlights.mutate([...filteredHighlights, newHighlight])
      setSelection(null)
      window.getSelection()?.removeAllRanges()
    },
    [selection, currentHighlights, updateHighlights],
  )

  // Remove a specific highlight (when clicking on already highlighted text)
  const handleRemoveHighlight = useCallback(() => {
    if (!selection) return

    const filteredHighlights = currentHighlights.filter(
      (h) =>
        h.endOffset <= selection.startOffset ||
        h.startOffset >= selection.endOffset,
    )

    updateHighlights.mutate(filteredHighlights)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
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
        top: selection.rect.top - 50,
        transform: 'translateX(-50%)',
        zIndex: 1000,
      }
    : undefined

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="relative"
      style={{ userSelect: enabled ? 'text' : 'none' }}
    >
      {children}

      {/* Highlight color popup */}
      {selection && (
        <div
          id="highlight-popup"
          style={popupStyle}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex items-center gap-1"
        >
          {/* Color swatches */}
          {colors.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => handleColorClick(color.color)}
              className="w-6 h-6 rounded border-2 border-transparent hover:border-gray-400 dark:hover:border-gray-500 transition-all"
              style={{ backgroundColor: color.color }}
              title={color.name}
            />
          ))}

          {/* Remove highlight button */}
          {hasExistingHighlight && (
            <>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
              <button
                type="button"
                onClick={handleRemoveHighlight}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title={t('highlight.removeHighlight', 'Remove Highlight')}
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Manage colors button */}
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            type="button"
            onClick={() => {
              setSelection(null)
              setIsColorManagerOpen(true)
            }}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title={t('highlight.manageColors', 'Manage Colors')}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Clear all highlights button */}
      {currentHighlights.length > 0 && (
        <button
          type="button"
          onClick={() => clearHighlights.mutate()}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-800/70 text-white rounded hover:bg-gray-700 transition-colors"
          title={t('highlight.clearAll', 'Clear All Highlights')}
        >
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
