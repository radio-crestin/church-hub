import { useEffect, useRef, useState } from 'react'

import { ScreenContent } from './rendering/ScreenContent'
import type { ContentData } from './rendering/types'
import { getBackgroundCSS } from './rendering/utils/styleUtils'
import type { ContentType, ScreenWithConfigs } from '../types'

interface ScreenPreviewProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  contentData: ContentData
  isVisible?: boolean
}

export function ScreenPreview({
  screen,
  contentType,
  contentData,
  isVisible = true,
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

  // Get background from screen config
  const config = screen.contentConfigs[contentType]
  const bg = config?.background || screen.contentConfigs.empty?.background

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={bg ? getBackgroundCSS(bg) : { backgroundColor: '#000000' }}
    >
      <ScreenContent
        screen={screen}
        contentType={contentType}
        contentData={contentData}
        containerWidth={displaySize.width}
        containerHeight={displaySize.height}
        isVisible={isVisible}
      />
    </div>
  )
}
