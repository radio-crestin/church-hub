import { useEffect, useRef, useState } from 'react'

import { ScreenBackground } from './rendering/ScreenBackground'
import { ScreenContent } from './rendering/ScreenContent'
import type { ContentData } from './rendering/types'
import type {
  ClockOverride,
  ContentType,
  ScreenBackgroundConfig,
  ScreenWithConfigs,
  TextStyleRange,
} from '../types'
import { resolveScreenBackground } from '../utils/resolveScreenBackground'

/** What a preview draws instead of the background when it is hidden. */
const HIDDEN_BACKGROUND: ScreenBackgroundConfig = {
  type: 'color',
  color: '#000000',
  opacity: 1,
}

interface ScreenPreviewProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  contentData: ContentData
  contentKey?: string
  isVisible?: boolean
  styleRanges?: TextStyleRange[]
  /** Stage editor: make the main lyrics element editable in place */
  editableMainText?: boolean
  /** Placeholder shown on an empty editable slide */
  editPlaceholder?: string
  /** Called with the edited plain text (newline-separated lines) */
  onMainTextEdit?: (plainText: string) => void
  /** Bumped when the slide's text is rewritten from outside the editor. */
  textVersion?: number
  /** Control Room: show this clock instead of the screen's (see ScreenContent) */
  clockOverride?: ClockOverride
  /** false shows a still frame of a video background (e.g. slide thumbnails) */
  playVideo?: boolean
  /**
   * Plain black instead of the background, so the lyrics are easy to read in
   * an operator's preview. Never set for a projected screen.
   */
  hideBackground?: boolean
}

export function ScreenPreview({
  screen,
  contentType,
  contentData,
  contentKey,
  isVisible = true,
  styleRanges,
  editableMainText,
  editPlaceholder,
  onMainTextEdit,
  textVersion,
  clockOverride,
  playVideo = true,
  hideBackground = false,
}: ScreenPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [displaySize, setDisplaySize] = useState({ width: 400, height: 225 })

  // Calculate display size based on container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setDisplaySize({ width: rect.width, height: rect.height })
      }
    }

    updateSize()

    // Use ResizeObserver for container changes
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(updateSize)
      resizeObserver.observe(containerRef.current)
      return () => resizeObserver.disconnect()
    }
  }, [])

  const bg = hideBackground
    ? HIDDEN_BACKGROUND
    : resolveScreenBackground({ screen, contentType, contentData })

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* First, so the (positioned) content paints above it */}
      <ScreenBackground background={bg} playVideo={playVideo} />
      <ScreenContent
        screen={screen}
        contentType={contentType}
        contentData={contentData}
        contentKey={contentKey}
        containerWidth={displaySize.width}
        containerHeight={displaySize.height}
        isVisible={isVisible}
        styleRanges={styleRanges}
        editableMainText={editableMainText}
        editPlaceholder={editPlaceholder}
        onMainTextEdit={onMainTextEdit}
        textVersion={textVersion}
        clockOverride={clockOverride}
      />
    </div>
  )
}
