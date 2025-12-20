import { TextElement } from './TextElement'
import type { ContentData, NextSlideData } from './types'
import {
  calculatePixelBounds,
  getBackgroundCSS,
  getTextStyleCSS,
} from './utils/styleUtils'
import type { ContentType, ScreenWithConfigs } from '../../types'

interface ScreenContentProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  contentData: ContentData | null
  containerWidth: number
  containerHeight: number
  showClock?: boolean
  isVisible?: boolean
  nextSlideData?: NextSlideData
}

export function ScreenContent({
  screen,
  contentType,
  contentData,
  containerWidth,
  containerHeight,
  showClock = true,
  isVisible = true,
  nextSlideData,
}: ScreenContentProps) {
  const config = screen.contentConfigs[contentType]
  const canvasWidth = screen.width
  const canvasHeight = screen.height

  // Calculate scale maintaining aspect ratio
  const scaleX = containerWidth / canvasWidth
  const scaleY = containerHeight / canvasHeight
  const scale = Math.min(scaleX, scaleY)

  // Calculate actual display size (centered if aspect ratio differs)
  const displayWidth = canvasWidth * scale
  const displayHeight = canvasHeight * scale
  const offsetX = (containerWidth - displayWidth) / 2
  const offsetY = (containerHeight - displayHeight) / 2

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
        scale={scale}
        isVisible={true}
        isHtml={true}
      />
    )
  }

  // Render content text
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
        scale={scale}
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
        scale={scale}
        isVisible={true}
        isHtml={false}
      />
    )
  }

  // Render person label
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
        scale={scale}
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

    // Calculate pixel bounds and scale
    const bounds = calculatePixelBounds(
      clockConfig.constraints,
      clockConfig.size,
      canvasWidth,
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
          left: bounds.x * scale,
          top: bounds.y * scale,
          width: bounds.width * scale,
          height: bounds.height * scale,
          ...getTextStyleCSS(clockConfig.style),
          fontSize: clockConfig.style.maxFontSize * scale,
        }}
      >
        {timeString}
      </div>
    )
  }

  // Render next slide section (stage screens)
  const renderNextSlideSection = () => {
    if (screen.type !== 'stage' || !screen.nextSlideConfig?.enabled) return null
    const ns = screen.nextSlideConfig

    const bounds = calculatePixelBounds(
      ns.constraints,
      ns.size,
      canvasWidth,
      canvasHeight,
    )

    return (
      <div
        key="nextSlide"
        className="absolute overflow-hidden"
        style={{
          left: bounds.x * scale,
          top: bounds.y * scale,
          width: bounds.width * scale,
          height: bounds.height * scale,
          padding: 16 * scale,
          ...getBackgroundCSS(ns.background),
        }}
      >
        <div
          style={{
            ...getTextStyleCSS(ns.labelStyle),
            fontSize: ns.labelStyle.maxFontSize * scale,
          }}
        >
          {ns.labelText}
        </div>
        <div
          style={{
            ...getTextStyleCSS(ns.contentStyle),
            fontSize: ns.contentStyle.maxFontSize * scale,
            marginTop: 8 * scale,
          }}
        >
          {nextSlideData?.preview || ''}
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: containerWidth,
        height: containerHeight,
      }}
    >
      {/* Single container at display dimensions, centered */}
      <div
        className="absolute"
        style={{
          left: offsetX,
          top: offsetY,
          width: displayWidth,
          height: displayHeight,
          position: 'relative',
          ...(bg ? getBackgroundCSS(bg) : { backgroundColor: '#000000' }),
        }}
      >
        {isVisible && (
          <>
            {renderMainText()}
            {renderContentText()}
            {renderReferenceText()}
            {renderPersonLabel()}
          </>
        )}
        {renderClock()}
        {renderNextSlideSection()}
      </div>
    </div>
  )
}
