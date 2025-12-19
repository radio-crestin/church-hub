import { useEffect, useRef, useState } from 'react'

import { TextElement } from './rendering/TextElement'
import {
  getBackgroundCSS,
  getTextStyleCSS,
  toPixels,
} from './rendering/utils/styleUtils'
import type { ContentType, ScreenWithConfigs } from '../types'

interface ContentData {
  mainText?: string
  referenceText?: string
  contentText?: string
  personLabel?: string
}

interface ScreenPreviewProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  contentData: ContentData
  showClock?: boolean
}

export function ScreenPreview({
  screen,
  contentType,
  contentData,
  showClock = true,
}: ScreenPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [displaySize, setDisplaySize] = useState({ width: 400, height: 225 })

  const config = screen.contentConfigs[contentType]
  const canvasWidth = screen.width
  const canvasHeight = screen.height

  // Calculate display size to fit container while maintaining aspect ratio
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
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [canvasWidth, canvasHeight])

  const scale = displaySize.width / canvasWidth

  // Background
  const bg = config?.background || screen.contentConfigs.empty?.background

  // Render main text
  const renderMainText = () => {
    if (!config || !('mainText' in config) || !contentData?.mainText)
      return null

    const configWithAutoScale = {
      ...config.mainText,
      style: { ...config.mainText.style, autoScale: true },
    }

    return (
      <TextElement
        key="mainText"
        config={configWithAutoScale}
        content={contentData.mainText}
        screenWidth={canvasWidth}
        screenHeight={canvasHeight}
        isVisible={true}
        isHtml={true}
      />
    )
  }

  // Render content text (for bible, versete_tineri)
  const renderContentText = () => {
    if (!config || !('contentText' in config) || !contentData?.contentText)
      return null

    const configWithAutoScale = {
      ...config.contentText,
      style: { ...config.contentText.style, autoScale: true },
    }

    return (
      <TextElement
        key="contentText"
        config={configWithAutoScale}
        content={contentData.contentText}
        screenWidth={canvasWidth}
        screenHeight={canvasHeight}
        isVisible={true}
        isHtml={false}
      />
    )
  }

  // Render reference text
  const renderReferenceText = () => {
    if (!config || !('referenceText' in config) || !contentData?.referenceText)
      return null

    const configWithAutoScale = {
      ...config.referenceText,
      style: { ...config.referenceText.style, autoScale: true },
    }

    return (
      <TextElement
        key="referenceText"
        config={configWithAutoScale}
        content={contentData.referenceText}
        screenWidth={canvasWidth}
        screenHeight={canvasHeight}
        isVisible={true}
        isHtml={false}
      />
    )
  }

  // Render person label (versete_tineri)
  const renderPersonLabel = () => {
    if (!config || !('personLabel' in config) || !contentData?.personLabel)
      return null

    const configWithAutoScale = {
      ...config.personLabel,
      style: { ...config.personLabel.style, autoScale: true },
    }

    return (
      <TextElement
        key="personLabel"
        config={configWithAutoScale}
        content={contentData.personLabel}
        screenWidth={canvasWidth}
        screenHeight={canvasHeight}
        isVisible={true}
        isHtml={false}
      />
    )
  }

  // Render clock
  const renderClock = () => {
    if (!showClock) return null
    const clockConfig =
      config && 'clock' in config
        ? config.clock
        : screen.globalSettings.clockConfig
    if (!clockConfig?.enabled) return null

    const x = toPixels(
      clockConfig.position.x,
      clockConfig.position.unit,
      canvasWidth,
    )
    const y = toPixels(
      clockConfig.position.y,
      clockConfig.position.unit,
      canvasHeight,
    )

    const now = new Date()
    const timeString = clockConfig.showSeconds
      ? now.toLocaleTimeString('ro-RO', { hour12: false })
      : now.toLocaleTimeString('ro-RO', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

    return (
      <div
        key="clock"
        className="absolute overflow-hidden flex items-center justify-end"
        style={{
          right: canvasWidth - x,
          top: y,
          ...getTextStyleCSS(clockConfig.style),
          fontSize: clockConfig.style.maxFontSize,
        }}
      >
        {timeString}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg shadow-lg"
      style={{
        width: displaySize.width,
        height: displaySize.height,
      }}
    >
      {/* Inner container at original screen dimensions, scaled down */}
      <div
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
          ...(bg ? getBackgroundCSS(bg) : { backgroundColor: '#000000' }),
        }}
      >
        {renderMainText()}
        {renderContentText()}
        {renderReferenceText()}
        {renderPersonLabel()}
        {renderClock()}
      </div>
    </div>
  )
}
