import { AnimatedElement } from './AnimatedElement'
import { TextContent } from './TextContent'
import type { ContentData, NextSlideData } from './types'
import { calculatePixelBounds, getBackgroundCSS } from './utils/styleUtils'
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

  // Calculate separate X and Y scales to stretch-fill the container
  // This ensures content fills the entire viewport regardless of aspect ratio
  const scaleX = containerWidth / canvasWidth
  const scaleY = containerHeight / canvasHeight
  // Use minimum scale for fonts to avoid excessive distortion
  const fontScale = Math.min(scaleX, scaleY)

  // Helper to scale bounds with separate X/Y scaling
  const scaleBounds = (bounds: {
    x: number
    y: number
    width: number
    height: number
  }) => ({
    x: bounds.x * scaleX,
    y: bounds.y * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY,
  })

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
    const scaledBounds = scaleBounds(bounds)

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
            maxFontSize: mt.style.maxFontSize * fontScale,
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
    const scaledBounds = scaleBounds(bounds)

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
            maxFontSize: ct.style.maxFontSize * fontScale,
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
    const scaledBounds = scaleBounds(bounds)

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
            maxFontSize: rt.style.maxFontSize * fontScale,
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
    const scaledBounds = scaleBounds(bounds)

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
            maxFontSize: pl.style.maxFontSize * fontScale,
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

    // Default size for backwards compatibility (must match ScreenEditorCanvas.tsx)
    const clockSize = clockConfig.size ?? {
      width: 10,
      widthUnit: '%' as const,
      height: 5,
      heightUnit: '%' as const,
    }

    // Calculate pixel bounds
    const bounds = calculatePixelBounds(
      clockConfig.constraints,
      clockSize,
      canvasWidth,
      canvasHeight,
    )

    // For clock, use uniform scaling (fontScale) to maintain aspect ratio
    // This prevents distortion when scaleX !== scaleY
    const scaledWidth = bounds.width * fontScale
    const scaledHeight = bounds.height * fontScale

    // Calculate position based on constraints with proper scaling
    const constraints = clockConfig.constraints
    let scaledX: number
    let scaledY: number

    // Horizontal positioning
    if (constraints.right.enabled && !constraints.left.enabled) {
      // Right-aligned: position from right edge
      const rightPx =
        constraints.right.unit === '%'
          ? (constraints.right.value / 100) * containerWidth
          : constraints.right.value * scaleX
      scaledX = containerWidth - rightPx - scaledWidth
    } else {
      // Left-aligned or both: use standard scaling
      scaledX = bounds.x * scaleX
    }

    // Vertical positioning
    if (constraints.bottom.enabled && !constraints.top.enabled) {
      // Bottom-aligned: position from bottom edge
      const bottomPx =
        constraints.bottom.unit === '%'
          ? (constraints.bottom.value / 100) * containerHeight
          : constraints.bottom.value * scaleY
      scaledY = containerHeight - bottomPx - scaledHeight
    } else {
      // Top-aligned or both: use standard scaling
      scaledY = bounds.y * scaleY
    }

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
        className="absolute overflow-hidden"
        style={{
          left: scaledX,
          top: scaledY,
          width: scaledWidth,
          height: scaledHeight,
        }}
      >
        <TextContent
          content={timeString}
          style={{
            ...clockConfig.style,
            maxFontSize: clockConfig.style.maxFontSize * fontScale,
          }}
          containerWidth={scaledWidth}
          containerHeight={scaledHeight}
        />
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
    const scaledBounds = scaleBounds(bounds)
    const padding = 16 * fontScale
    const gap = 8 * fontScale

    // Calculate heights for label and content
    // Label takes a portion based on its style, content gets the rest
    const labelHeight = Math.min(
      scaledBounds.height * 0.3,
      ns.labelStyle.maxFontSize * fontScale * 1.5,
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
              maxFontSize: ns.labelStyle.maxFontSize * fontScale,
              minFontSize: (ns.labelStyle.minFontSize ?? 12) * fontScale,
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
              maxFontSize: ns.contentStyle.maxFontSize * fontScale,
              minFontSize: (ns.contentStyle.minFontSize ?? 12) * fontScale,
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
      className="relative"
      style={{
        width: containerWidth,
        height: containerHeight,
      }}
    >
      {/* Content fills entire container - no letterboxing */}
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
  )
}
