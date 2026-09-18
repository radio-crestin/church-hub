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
import type { ClockOverride, TemporaryContent, TextStyleRange } from '../types'

// Default highlight color
const DEFAULT_HIGHLIGHT_COLOR = '#FFFF00'

// Stable empty array to prevent unnecessary re-renders when no highlights exist
const EMPTY_STYLE_RANGES: TextStyleRange[] = []

// The frame spans the full width and at most the full height of the space it
// is given; the box inside is the largest one of the screen's proportions that
// fits the frame, centred. Where the parent has no fixed height (song, Bible and
// program panels) the frame simply follows the width.
//
// The box is taken out of flow on purpose. In flow, WebKit (the macOS desktop
// app) resolves its `h-full` against the frame's width-derived height before
// `max-h-full` caps it, so where the space is wider than the screen the box
// grows past the frame and its bottom is cut off — the last lines of the
// lyrics with it. Positioned against the frame, the height is the frame's
// final one in every engine. Centred with auto margins, not a transform, so
// the fixed-position context menu inside stays anchored to the viewport.
const FRAME_CLASS = 'relative w-full max-h-full min-h-0'
const BOX_CLASS =
  'absolute inset-0 m-auto h-full max-w-full rounded-lg overflow-hidden shadow-lg'

interface LivePreviewProps {
  /**
   * Local preview override (Preview mode). When set, the stage shows this
   * staged content instead of the live projection, without affecting external
   * screens. Omitted everywhere except the song-detail control panel.
   */
  previewContent?: TemporaryContent | null
  /**
   * A clock shown in place of the preview screen's own one, on every content
   * type. Only the Control Room sets it; everywhere else the preview mirrors
   * the screen's clock exactly.
   */
  clockOverride?: ClockOverride
  /**
   * Plain black behind the text instead of the background (the song page's
   * "Background" toggle). Only this preview changes, never the screens.
   */
  hideBackground?: boolean
}

export function LivePreview({
  previewContent = null,
  clockOverride,
  hideBackground = false,
}: LivePreviewProps) {
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

  // Pick which screen to mirror in the preview:
  // 1. the screen explicitly flagged as the preview screen, if any
  // 2. otherwise fall back to the first primary screen (by sort order)
  const previewScreen = useMemo(() => {
    if (!screens) return null
    const flagged = screens.find((s) => s.isPreviewScreen)
    if (flagged) return flagged
    return (
      screens
        .filter((s) => s.type === 'primary')
        .sort((a, b) => a.sortOrder - b.sortOrder)[0] || null
    )
  }, [screens])

  // Get full config for the preview screen (use undefined if none exists)
  const { data: screen } = useScreen(previewScreen?.id ?? undefined)

  // Use shared presentation content hook
  const { contentType, contentData, contentKey, isVisible } =
    usePresentationContent({
      screen,
      includeNextSlide: false,
      getBookName,
      previewContent,
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

  // Keep the preview in the projected screen's own proportions (16:9 until the
  // screen's size is known), so elements land where they do on the screen.
  const screenWidth = screen?.width ?? previewScreen?.width
  const screenHeight = screen?.height ?? previewScreen?.height
  const aspectRatio =
    screenWidth && screenHeight ? `${screenWidth} / ${screenHeight}` : '16 / 9'

  // Loading state
  if (!screen) {
    return (
      <div className={FRAME_CLASS} style={{ aspectRatio }}>
        <div
          className={`${BOX_CLASS} bg-gray-800 flex items-center justify-center`}
          style={{ aspectRatio }}
        >
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={FRAME_CLASS} style={{ aspectRatio }}>
      <div
        ref={previewContainerRef}
        data-testid="live-preview"
        className={BOX_CLASS}
        style={{ aspectRatio }}
        onContextMenu={handleContextMenu}
      >
        <ScreenPreview
          screen={screen}
          contentType={contentType}
          contentData={contentData}
          contentKey={contentKey}
          isVisible={isVisible}
          styleRanges={styleRanges}
          clockOverride={clockOverride}
          hideBackground={hideBackground}
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
    </div>
  )
}
