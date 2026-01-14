import { useCallback, useMemo, useRef, useState } from 'react'

import { useLocalizedBookNames } from '~/features/bible/hooks'
import { ScreenPreview } from './ScreenPreview'
import { TextStyleContextMenu } from './TextStyleContextMenu'
import { usePresentationState } from '../hooks'
import { usePresentationContent } from '../hooks/usePresentationContent'
import { useScreen } from '../hooks/useScreen'
import { useScreens } from '../hooks/useScreens'
import {
  useAddSlideHighlight,
  useRemoveSlideHighlight,
  useSlideHighlights,
} from '../hooks/useSlideHighlights'
import { useTextSelection } from '../hooks/useTextSelection'
import type { TextStyleRange } from '../types'

// Default highlight color
const DEFAULT_HIGHLIGHT_COLOR = '#FFFF00'

// Stable empty array to prevent unnecessary re-renders when no highlights exist
const EMPTY_STYLE_RANGES: TextStyleRange[] = []

export function LivePreview() {
  // Note: WebSocket connection is established by parent ControlRoom component
  // Don't call useWebSocket() here as it causes re-renders from debug info state updates

  const { data: presentationState } = usePresentationState()
  const { data: screens } = useScreens()
  const { getBookName } = useLocalizedBookNames()

  // Highlight hooks
  const { data: slideHighlights } = useSlideHighlights()
  const addHighlight = useAddSlideHighlight()
  const removeHighlight = useRemoveSlideHighlight()

  // Ref for text selection tracking
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const { getSelectedRange, hasSelection, clearSelection } =
    useTextSelection(previewContainerRef)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    clickedHighlightId?: string
  }>({ visible: false, x: 0, y: 0 })

  // Find first primary screen (regardless of window open state)
  const primaryScreen = useMemo(() => {
    if (!screens) return null
    return (
      screens
        .filter((s) => s.type === 'primary')
        .sort((a, b) => a.sortOrder - b.sortOrder)[0] || null
    )
  }, [screens])

  // Get full config for the primary screen (use undefined if no primary screen exists)
  const { data: screen } = useScreen(primaryScreen?.id ?? undefined)

  // Use shared presentation content hook
  const { contentType, contentData, isVisible } = usePresentationContent({
    screen,
    includeNextSlide: false,
    getBookName,
  })

  // Handle context menu (right-click) on preview
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Check if clicked on an existing styled element (mark, strong, u with data-highlight-id)
      const target = e.target as HTMLElement
      const styledElement = target.closest(
        '[data-highlight-id]',
      ) as HTMLElement | null
      const highlightId = styledElement?.dataset?.highlightId

      // Show context menu if text is selected OR clicking on existing styled text
      // hasSelection() reads from ref - doesn't trigger re-renders
      if (hasSelection() || highlightId) {
        e.preventDefault()
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          clickedHighlightId: highlightId,
        })
      }
    },
    [hasSelection],
  )

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 })
  }, [])

  const handleHighlight = useCallback(() => {
    const selectedRange = getSelectedRange()
    if (!selectedRange) return
    addHighlight.mutate({
      start: selectedRange.start,
      end: selectedRange.end,
      highlight: DEFAULT_HIGHLIGHT_COLOR,
    })
    clearSelection()
  }, [getSelectedRange, addHighlight, clearSelection])

  const handleBold = useCallback(() => {
    const selectedRange = getSelectedRange()
    if (!selectedRange) return
    addHighlight.mutate({
      start: selectedRange.start,
      end: selectedRange.end,
      bold: true,
    })
    clearSelection()
  }, [getSelectedRange, addHighlight, clearSelection])

  const handleUnderline = useCallback(() => {
    const selectedRange = getSelectedRange()
    if (!selectedRange) return
    addHighlight.mutate({
      start: selectedRange.start,
      end: selectedRange.end,
      underline: true,
    })
    clearSelection()
  }, [getSelectedRange, addHighlight, clearSelection])

  const handleRemoveStyle = useCallback(() => {
    if (contextMenu.clickedHighlightId) {
      removeHighlight.mutate(contextMenu.clickedHighlightId)
    }
  }, [contextMenu.clickedHighlightId, removeHighlight])

  // Get highlights from either query or presentation state
  // Memoized to prevent unnecessary reference changes that cause re-renders
  // which could clear text selections during DOM reconciliation
  const styleRanges = useMemo((): TextStyleRange[] => {
    return (
      slideHighlights ??
      presentationState?.slideHighlights ??
      EMPTY_STYLE_RANGES
    )
  }, [slideHighlights, presentationState?.slideHighlights])

  // Loading state
  if (!screen) {
    return (
      <div className="relative h-full max-w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-gray-800 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div
      ref={previewContainerRef}
      className="relative h-full max-w-full aspect-video rounded-lg overflow-hidden shadow-lg"
      onContextMenu={handleContextMenu}
    >
      <ScreenPreview
        screen={screen}
        contentType={contentType}
        contentData={contentData}
        isVisible={isVisible}
        styleRanges={styleRanges}
      />
      {contextMenu.visible && (
        <TextStyleContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleCloseContextMenu}
          onHighlight={handleHighlight}
          onBold={handleBold}
          onUnderline={handleUnderline}
          onRemoveStyle={handleRemoveStyle}
          showRemove={!!contextMenu.clickedHighlightId}
          highlightColor={DEFAULT_HIGHLIGHT_COLOR}
        />
      )}
    </div>
  )
}
