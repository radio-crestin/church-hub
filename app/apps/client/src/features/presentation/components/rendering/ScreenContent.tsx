import { AnimatedElement } from './AnimatedElement'
import { TextContent } from './TextContent'
import type { ContentData, NextSlideData } from './types'
import {
  calculatePixelBounds,
  getBackgroundCSS,
  getTextStyleCSS,
} from './utils/styleUtils'
import type {
  BibleContentConfig,
  ContentType,
  LiveHighlight,
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
  fillContainer?: boolean
  /** Live highlights applied during presentation (in-memory only) */
  liveHighlights?: LiveHighlight[]
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
  fillContainer = false,
  liveHighlights = [],
}: ScreenContentProps) {
  const config = screen.contentConfigs[contentType]
  const canvasWidth = fillContainer ? containerWidth : screen.width
  const canvasHeight = fillContainer ? containerHeight : screen.height

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
          liveHighlights={liveHighlights}
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
          liveHighlights={liveHighlights}
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
    const labelHeight = ns.labelStyle.maxFontSize * scale + 8 * scale
    const contentHeight = scaledBounds.height - padding * 2 - labelHeight

    // Render content based on whether we have versete_tineri summary
    const renderNextSlideContent = () => {
      if (nextSlideData?.verseteTineriSummary) {
        const { entries, hasMore } = nextSlideData.verseteTineriSummary
        return (
          <span
            style={{
              ...getTextStyleCSS(ns.contentStyle),
              fontSize: ns.contentStyle.maxFontSize * scale,
            }}
          >
            {entries.map((entry, index) => (
              <span key={index}>
                {entry.personName} - {entry.reference}
                {index < entries.length - 1 && ' • '}
              </span>
            ))}
            {hasMore && ' ...'}
          </span>
        )
      }

      const preview = nextSlideData?.preview || ''
      if (!preview) return null

      return (
        <span
          style={{
            ...getTextStyleCSS(ns.contentStyle),
            fontSize: ns.contentStyle.maxFontSize * scale,
          }}
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      )
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
          ...getBackgroundCSS(ns.background),
        }}
      >
        <div
          style={{
            ...getTextStyleCSS(ns.labelStyle),
            fontSize: ns.labelStyle.maxFontSize * scale,
            flexShrink: 0,
          }}
        >
          {ns.labelText}
        </div>
        <div
          style={{
            marginTop: 8 * scale,
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {renderNextSlideContent()}
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
