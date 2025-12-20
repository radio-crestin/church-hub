import { AnimatedElement } from './AnimatedElement'
import { TextContent } from './TextContent'
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

  // Render main text
  const renderMainText = () => {
    if (!config || !('mainText' in config) || !contentData?.mainText)
      return null

    const mt = config.mainText
    const bounds = calculatePixelBounds(
      mt.constraints,
      mt.size,
      canvasWidth,
      canvasHeight,
    )
    const scaledBounds = {
      x: bounds.x * scale,
      y: bounds.y * scale,
      width: bounds.width * scale,
      height: bounds.height * scale,
    }
    const padding = ('padding' in mt ? (mt.padding ?? 0) : 0) * scale

    return (
      <AnimatedElement
        key="mainText"
        animationIn={'animationIn' in mt ? mt.animationIn : undefined}
        animationOut={'animationOut' in mt ? mt.animationOut : undefined}
        isVisible={true}
        style={{
          position: 'absolute',
          left: scaledBounds.x,
          top: scaledBounds.y,
          width: scaledBounds.width,
          height: scaledBounds.height,
        }}
      >
        <TextContent
          content={contentData.mainText}
          style={{
            ...mt.style,
            autoScale: true,
            maxFontSize: mt.style.maxFontSize * scale,
          }}
          containerWidth={scaledBounds.width}
          containerHeight={scaledBounds.height}
          padding={padding}
          isHtml={true}
        />
      </AnimatedElement>
    )
  }

  // Render content text
  const renderContentText = () => {
    if (!config || !('contentText' in config) || !contentData?.contentText)
      return null

    const ct = config.contentText
    const bounds = calculatePixelBounds(
      ct.constraints,
      ct.size,
      canvasWidth,
      canvasHeight,
    )
    const scaledBounds = {
      x: bounds.x * scale,
      y: bounds.y * scale,
      width: bounds.width * scale,
      height: bounds.height * scale,
    }

    return (
      <AnimatedElement
        key="contentText"
        animationIn={'animationIn' in ct ? ct.animationIn : undefined}
        animationOut={'animationOut' in ct ? ct.animationOut : undefined}
        isVisible={true}
        style={{
          position: 'absolute',
          left: scaledBounds.x,
          top: scaledBounds.y,
          width: scaledBounds.width,
          height: scaledBounds.height,
        }}
      >
        <TextContent
          content={contentData.contentText}
          style={{
            ...ct.style,
            autoScale: true,
            maxFontSize: ct.style.maxFontSize * scale,
          }}
          containerWidth={scaledBounds.width}
          containerHeight={scaledBounds.height}
          isHtml={false}
        />
      </AnimatedElement>
    )
  }

  // Render reference text
  const renderReferenceText = () => {
    if (!config || !('referenceText' in config) || !contentData?.referenceText)
      return null

    const rt = config.referenceText
    const bounds = calculatePixelBounds(
      rt.constraints,
      rt.size,
      canvasWidth,
      canvasHeight,
    )
    const scaledBounds = {
      x: bounds.x * scale,
      y: bounds.y * scale,
      width: bounds.width * scale,
      height: bounds.height * scale,
    }

    return (
      <AnimatedElement
        key="referenceText"
        animationIn={'animationIn' in rt ? rt.animationIn : undefined}
        animationOut={'animationOut' in rt ? rt.animationOut : undefined}
        isVisible={true}
        style={{
          position: 'absolute',
          left: scaledBounds.x,
          top: scaledBounds.y,
          width: scaledBounds.width,
          height: scaledBounds.height,
        }}
      >
        <TextContent
          content={contentData.referenceText}
          style={{
            ...rt.style,
            autoScale: true,
            maxFontSize: rt.style.maxFontSize * scale,
          }}
          containerWidth={scaledBounds.width}
          containerHeight={scaledBounds.height}
          isHtml={false}
        />
      </AnimatedElement>
    )
  }

  // Render person label
  const renderPersonLabel = () => {
    if (!config || !('personLabel' in config) || !contentData?.personLabel)
      return null

    const pl = config.personLabel
    const bounds = calculatePixelBounds(
      pl.constraints,
      pl.size,
      canvasWidth,
      canvasHeight,
    )
    const scaledBounds = {
      x: bounds.x * scale,
      y: bounds.y * scale,
      width: bounds.width * scale,
      height: bounds.height * scale,
    }

    return (
      <AnimatedElement
        key="personLabel"
        animationIn={'animationIn' in pl ? pl.animationIn : undefined}
        animationOut={'animationOut' in pl ? pl.animationOut : undefined}
        isVisible={true}
        style={{
          position: 'absolute',
          left: scaledBounds.x,
          top: scaledBounds.y,
          width: scaledBounds.width,
          height: scaledBounds.height,
        }}
      >
        <TextContent
          content={contentData.personLabel}
          style={{
            ...pl.style,
            autoScale: true,
            maxFontSize: pl.style.maxFontSize * scale,
          }}
          containerWidth={scaledBounds.width}
          containerHeight={scaledBounds.height}
          isHtml={false}
        />
      </AnimatedElement>
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
      {/* Single container at display dimensions, centered - no background (parent handles it) */}
      <div
        className="absolute"
        style={{
          left: offsetX,
          top: offsetY,
          width: displayWidth,
          height: displayHeight,
          position: 'relative',
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
