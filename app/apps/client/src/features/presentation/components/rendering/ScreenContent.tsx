import { AnimatedElement } from './AnimatedElement'
import { TextContent } from './TextContent'
import type { ContentData, NextSlideData } from './types'
import {
  calculatePixelBounds,
  getBackgroundCSS,
  getJustifyContent,
  getTextStyleCSS,
} from './utils/styleUtils'
import type {
  BibleContentConfig,
  ContentType,
  ScreenWithConfigs,
} from '../../types'

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
  // Always use screen dimensions for bounds calculations
  // Constraints are defined relative to the screen's native resolution
  const canvasWidth = screen.width
  const canvasHeight = screen.height

  // Calculate scale to transform from screen space to container space
  // Always use Math.min to ensure content fits within container (responsive to any size)
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
    if (mt.hidden) return null
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
            maxFontSize: mt.style.maxFontSize * scale,
          }}
          containerWidth={scaledBounds.width}
          containerHeight={scaledBounds.height}
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
    if (ct.hidden) return null
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

    // Check if reference should be prepended to content
    const bibleConfig = config as BibleContentConfig
    const shouldPrependReference =
      bibleConfig.includeReferenceInContent && contentData.referenceText
    const displayContent = shouldPrependReference
      ? `${contentData.referenceText} ${contentData.contentText}`
      : contentData.contentText

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
          content={displayContent}
          style={{
            ...ct.style,
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
    if (rt.hidden) return null

    // Skip rendering if reference is included in content
    const bibleConfig = config as BibleContentConfig
    if (bibleConfig.includeReferenceInContent) return null

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
    if (pl.hidden) return null
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
    if (clockConfig.hidden) return null

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
        className="absolute overflow-hidden flex items-center"
        style={{
          left: bounds.x * scale,
          top: bounds.y * scale,
          width: bounds.width * scale,
          height: bounds.height * scale,
          ...getTextStyleCSS(clockConfig.style),
          fontSize: clockConfig.style.maxFontSize * scale,
          justifyContent: getJustifyContent(clockConfig.style.alignment),
        }}
      >
        {timeString}
      </div>
    )
  }

  // Render next slide section (configurable per screen)
  const renderNextSlideSection = () => {
    if (!screen.nextSlideConfig?.enabled) return null
    const ns = screen.nextSlideConfig
    if (ns.hidden) return null

    const bounds = calculatePixelBounds(
      ns.constraints,
      ns.size,
      canvasWidth,
      canvasHeight,
    )
    const scaledBounds = {
      x: bounds.x * scale,
      y: bounds.y * scale,
      width: bounds.width * scale,
      height: bounds.height * scale,
    }
    const padding = 16 * scale
    const gap = 8 * scale

    // Calculate heights for label and content
    // Label takes a portion based on its style, content gets the rest
    const labelHeight = Math.min(
      scaledBounds.height * 0.3,
      ns.labelStyle.maxFontSize * scale * 1.5,
    )
    const contentHeight = scaledBounds.height - padding * 2 - labelHeight - gap

    // Get content text
    const getContentText = () => {
      if (nextSlideData?.verseteTineriSummary) {
        const { entries, hasMore } = nextSlideData.verseteTineriSummary
        const text = entries
          .map((entry) => `${entry.personName} - ${entry.reference}`)
          .join(' • ')
        return hasMore ? `${text} ...` : text
      }
      return nextSlideData?.preview || ''
    }

    return (
      <div
        key="nextSlide"
        className="absolute overflow-hidden"
        style={{
          left: scaledBounds.x,
          top: scaledBounds.y,
          width: scaledBounds.width,
          height: scaledBounds.height,
          padding,
          display: 'flex',
          flexDirection: 'column',
          gap,
          ...getBackgroundCSS(ns.background),
        }}
      >
        <div style={{ height: labelHeight, flexShrink: 0 }}>
          <TextContent
            content={ns.labelText}
            style={{
              ...ns.labelStyle,
              maxFontSize: ns.labelStyle.maxFontSize * scale,
              minFontSize: (ns.labelStyle.minFontSize ?? 12) * scale,
            }}
            containerWidth={scaledBounds.width - padding * 2}
            containerHeight={labelHeight}
          />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <TextContent
            content={getContentText()}
            style={{
              ...ns.contentStyle,
              maxFontSize: ns.contentStyle.maxFontSize * scale,
              minFontSize: (ns.contentStyle.minFontSize ?? 12) * scale,
            }}
            containerWidth={scaledBounds.width - padding * 2}
            containerHeight={contentHeight}
            isHtml={
              !!nextSlideData?.preview && !nextSlideData?.verseteTineriSummary
            }
          />
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
