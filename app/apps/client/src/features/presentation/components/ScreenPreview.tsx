import { useEffect, useRef, useState } from 'react'

import { ScreenContent } from './rendering/ScreenContent'
import type { ContentData } from './rendering/types'
import { getBackgroundCSS } from './rendering/utils/styleUtils'
import type { ContentType, LiveHighlight, ScreenWithConfigs } from '../types'

interface ScreenPreviewProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  contentData: ContentData
  showClock?: boolean
  /** Live highlights applied during presentation (in-memory only) */
  liveHighlights?: LiveHighlight[]
}

export function ScreenPreview({
  screen,
  contentType,
  contentData,
  showClock = true,
  liveHighlights = [],
}: ScreenPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [displaySize, setDisplaySize] = useState({ width: 400, height: 225 })

  const canvasWidth = screen.width
  const canvasHeight = screen.height

  // Calculate display size to fit parent container while maintaining aspect ratio
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return
      const container = containerRef.current.parentElement
      if (!container) return

      const maxWidth = container.clientWidth
      const maxHeight = container.clientHeight || maxWidth * 0.5625 // 16:9 fallback
      const aspectRatio = canvasWidth / canvasHeight

      let width = maxWidth
      let height = width / aspectRatio

      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      setDisplaySize({ width, height })
    }

    updateSize()

    // Use ResizeObserver for parent container changes
    const container = containerRef.current?.parentElement
    if (container) {
      const resizeObserver = new ResizeObserver(updateSize)
      resizeObserver.observe(container)
      return () => resizeObserver.disconnect()
    }
  }, [canvasWidth, canvasHeight])

  // Get background from screen config
  const config = screen.contentConfigs[contentType]
  const bg = config?.background || screen.contentConfigs.empty?.background

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg shadow-lg"
      style={{
        width: displaySize.width,
        height: displaySize.height,
        ...(bg ? getBackgroundCSS(bg) : { backgroundColor: '#000000' }),
      }}
    >
      <ScreenContent
        screen={screen}
        contentType={contentType}
        contentData={contentData}
        containerWidth={displaySize.width}
        containerHeight={displaySize.height}
        showClock={showClock}
        isVisible={true}
        liveHighlights={liveHighlights}
      />
    </div>
  )
}
