import { Book, Megaphone, MonitorPlay, Music, User } from 'lucide-react'
import { useMemo, useRef } from 'react'

import { AnimatedText } from './AnimatedText'
import { ClockText } from './ClockText'
import { TextContent } from './TextContent'
import type { ContentData, NextSlideData } from './types'
import {
  calculatePixelBounds,
  clampBoundsToScreen,
  getBackgroundCSS,
} from './utils/styleUtils'
import type {
  BibleContentConfig,
  ContentType,
  ContentTypeConfig,
  ScreenWithConfigs,
  TextStyleRange,
} from '../../types'
import { formatReferenceWithWrapper } from '../../utils/formatReferenceWithWrapper'

interface ScreenContentProps {
  screen: ScreenWithConfigs
  contentType: ContentType
  contentData: ContentData | null
  containerWidth: number
  containerHeight: number
  isVisible?: boolean
  nextSlideData?: NextSlideData
  styleRanges?: TextStyleRange[]
}

export function ScreenContent({
  screen,
  contentType,
  contentData,
  containerWidth,
  containerHeight,
  isVisible = true,
  nextSlideData,
  styleRanges,
}: ScreenContentProps) {
  const currentConfig = screen.contentConfigs[contentType]

  // Cache the previous config when visible so we can use it for exit animations
  const cachedConfigRef = useRef<{
    config: ContentTypeConfig | undefined
    contentType: ContentType
  }>({ config: currentConfig, contentType })

  // Update cached config when visible and we have a non-empty content type
  if (isVisible && contentType !== 'empty' && currentConfig) {
    cachedConfigRef.current = { config: currentConfig, contentType }
  }

  // Use cached config when not visible (for exit animation), otherwise use current
  const config = isVisible ? currentConfig : cachedConfigRef.current.config

  // Generate a content key that changes when the actual content changes
  // Include start, end, and length to detect changes anywhere in the text
  const contentKey = useMemo(() => {
    if (!contentData) return 'empty'
    const parts: string[] = [contentType]
    if (contentData.mainText) {
      const text = contentData.mainText
      parts.push(`${text.slice(0, 30)}|${text.slice(-30)}|${text.length}`)
    }
    if (contentData.contentText) {
      const text = contentData.contentText
      parts.push(`${text.slice(0, 30)}|${text.slice(-30)}|${text.length}`)
    }
    if (contentData.referenceText) parts.push(contentData.referenceText)
    if (contentData.personLabel) parts.push(contentData.personLabel)
    return parts.join('|')
  }, [contentType, contentData])

  // Screen dimensions
  const canvasWidth = screen.width
  const canvasHeight = screen.height

  // Calculate scales
  const scaleX = containerWidth / canvasWidth
  const scaleY = containerHeight / canvasHeight
  const fontScale = Math.min(scaleX, scaleY)

  // Helper to scale bounds
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
    if (!config || !('mainText' in config)) return null

    const mt = config.mainText
    if (mt.hidden) return null

    const bounds = calculatePixelBounds(
      mt.constraints,
      mt.size,
      canvasWidth,
      canvasHeight,
    )
    const scaledBounds = scaleBounds(bounds)
    const elementVisible = isVisible && !!contentData?.mainText

    return (
      <AnimatedText
        key="mainText"
        content={contentData?.mainText ?? ''}
        contentKey={`mainText-${contentKey}`}
        isVisible={elementVisible}
        style={{
          ...mt.style,
          maxFontSize: mt.style.maxFontSize * fontScale,
        }}
        width={scaledBounds.width}
        height={scaledBounds.height}
        left={scaledBounds.x}
        top={scaledBounds.y}
        isHtml={true}
        animationIn={'animationIn' in mt ? mt.animationIn : undefined}
        animationOut={'animationOut' in mt ? mt.animationOut : undefined}
        slideTransitionIn={
          'slideTransitionIn' in mt ? mt.slideTransitionIn : undefined
        }
        slideTransitionOut={
          'slideTransitionOut' in mt ? mt.slideTransitionOut : undefined
        }
        styleRanges={styleRanges}
      />
    )
  }

  // Render content text
  const renderContentText = () => {
    if (!config || !('contentText' in config)) return null

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
      bibleConfig.includeReferenceInContent && contentData?.referenceText
    const formattedReference = contentData?.referenceText
      ? formatReferenceWithWrapper(
          contentData.referenceText,
          bibleConfig.referenceWrapperStyle,
        )
      : ''
    const displayContent = shouldPrependReference
      ? `${formattedReference} ${contentData?.contentText ?? ''}`
      : (contentData?.contentText ?? '')

    const elementVisible = isVisible && !!contentData?.contentText

    return (
      <AnimatedText
        key="contentText"
        content={displayContent}
        contentKey={`contentText-${contentKey}`}
        isVisible={elementVisible}
        style={{
          ...ct.style,
          maxFontSize: ct.style.maxFontSize * fontScale,
        }}
        width={scaledBounds.width}
        height={scaledBounds.height}
        left={scaledBounds.x}
        top={scaledBounds.y}
        isHtml={false}
        animationIn={'animationIn' in ct ? ct.animationIn : undefined}
        animationOut={'animationOut' in ct ? ct.animationOut : undefined}
        slideTransitionIn={
          'slideTransitionIn' in ct ? ct.slideTransitionIn : undefined
        }
        slideTransitionOut={
          'slideTransitionOut' in ct ? ct.slideTransitionOut : undefined
        }
        styleRanges={styleRanges}
      />
    )
  }

  // Render reference text
  const renderReferenceText = () => {
    if (!config || !('referenceText' in config)) return null

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
    const elementVisible = isVisible && !!contentData?.referenceText

    return (
      <AnimatedText
        key="referenceText"
        content={contentData?.referenceText ?? ''}
        contentKey={`referenceText-${contentKey}`}
        isVisible={elementVisible}
        style={{
          ...rt.style,
          maxFontSize: rt.style.maxFontSize * fontScale,
        }}
        width={scaledBounds.width}
        height={scaledBounds.height}
        left={scaledBounds.x}
        top={scaledBounds.y}
        isHtml={false}
        animationIn={'animationIn' in rt ? rt.animationIn : undefined}
        animationOut={'animationOut' in rt ? rt.animationOut : undefined}
        slideTransitionIn={
          'slideTransitionIn' in rt ? rt.slideTransitionIn : undefined
        }
        slideTransitionOut={
          'slideTransitionOut' in rt ? rt.slideTransitionOut : undefined
        }
      />
    )
  }

  // Render person label
  const renderPersonLabel = () => {
    if (!config || !('personLabel' in config)) return null

    const pl = config.personLabel
    if (pl.hidden) return null

    const bounds = calculatePixelBounds(
      pl.constraints,
      pl.size,
      canvasWidth,
      canvasHeight,
    )
    const scaledBounds = scaleBounds(bounds)
    const elementVisible = isVisible && !!contentData?.personLabel

    return (
      <AnimatedText
        key="personLabel"
        content={contentData?.personLabel ?? ''}
        contentKey={`personLabel-${contentKey}`}
        isVisible={elementVisible}
        style={{
          ...pl.style,
          maxFontSize: pl.style.maxFontSize * fontScale,
        }}
        width={scaledBounds.width}
        height={scaledBounds.height}
        left={scaledBounds.x}
        top={scaledBounds.y}
        isHtml={false}
        animationIn={'animationIn' in pl ? pl.animationIn : undefined}
        animationOut={'animationOut' in pl ? pl.animationOut : undefined}
        slideTransitionIn={
          'slideTransitionIn' in pl ? pl.slideTransitionIn : undefined
        }
        slideTransitionOut={
          'slideTransitionOut' in pl ? pl.slideTransitionOut : undefined
        }
      />
    )
  }

  // Render clock with its own timer state for reliable updates
  const renderClock = () => {
    const clockConfig = screen.globalSettings.clockConfig
    if (!clockConfig) return null
    if (clockConfig.hidden) return null

    // Check if clock is enabled for current content type
    const isClockEnabledForType =
      currentConfig &&
      (('clockEnabled' in currentConfig && currentConfig.clockEnabled) ||
        ('clock' in currentConfig &&
          currentConfig.clock &&
          typeof currentConfig.clock === 'object' &&
          'enabled' in currentConfig.clock &&
          currentConfig.clock.enabled))
    if (!isClockEnabledForType) return null

    const clockSize = clockConfig.size ?? {
      width: 10,
      widthUnit: '%' as const,
      height: 5,
      heightUnit: '%' as const,
    }

    const rawBounds = calculatePixelBounds(
      clockConfig.constraints,
      clockSize,
      canvasWidth,
      canvasHeight,
    )
    const bounds = clampBoundsToScreen(rawBounds, canvasWidth, canvasHeight)

    const scaledWidth = bounds.width * fontScale
    const scaledHeight = bounds.height * fontScale

    const constraints = clockConfig.constraints
    let scaledX: number
    let scaledY: number

    if (constraints.right.enabled && !constraints.left.enabled) {
      const rightPx =
        constraints.right.unit === '%'
          ? (constraints.right.value / 100) * containerWidth
          : constraints.right.value * scaleX
      scaledX = containerWidth - rightPx - scaledWidth
    } else {
      scaledX = bounds.x * scaleX
    }

    if (constraints.bottom.enabled && !constraints.top.enabled) {
      const bottomPx =
        constraints.bottom.unit === '%'
          ? (constraints.bottom.value / 100) * containerHeight
          : constraints.bottom.value * scaleY
      scaledY = containerHeight - bottomPx - scaledHeight
    } else {
      scaledY = bounds.y * scaleY
    }

    return (
      <ClockText
        key="clock"
        showSeconds={clockConfig.showSeconds}
        style={{
          ...clockConfig.style,
          maxFontSize: clockConfig.style.maxFontSize * fontScale,
        }}
        width={scaledWidth}
        height={scaledHeight}
        left={scaledX}
        top={scaledY}
      />
    )
  }

  // Render next slide section (not animated)
  const renderNextSlideSection = () => {
    if (!screen.nextSlideConfig?.enabled) return null
    const ns = screen.nextSlideConfig
    if (ns.hidden) return null
    // Hide section when there's no next slide data
    if (!nextSlideData) return null

    const bounds = calculatePixelBounds(
      ns.constraints,
      ns.size,
      canvasWidth,
      canvasHeight,
    )
    const scaledBounds = scaleBounds(bounds)
    const padding = 16 * fontScale
    const gap = 8 * fontScale

    const labelHeight = Math.min(
      scaledBounds.height * 0.3,
      ns.labelStyle.maxFontSize * fontScale * 1.5,
    )
    const contentHeight = scaledBounds.height - padding * 2 - labelHeight - gap

    // Build the label text: "Urmează:" + type-specific label + title
    const getLabelText = () => {
      if (!nextSlideData?.label) return ns.labelText
      // Include title for items that have one (e.g., songs)
      if (nextSlideData.title) {
        return `${ns.labelText} ${nextSlideData.label} - ${nextSlideData.title}`
      }
      // No title - just show the label without trailing colon
      return `${ns.labelText} ${nextSlideData.label}`
    }

    const getContentText = () => {
      if (nextSlideData?.verseteTineriSummary) {
        const { entries, hasMore } = nextSlideData.verseteTineriSummary
        // Show person names with reference in parentheses
        const text = entries
          .map((entry) => `${entry.personName} (${entry.reference})`)
          .join(', ')
        return hasMore ? `${text}, ...` : text
      }
      return nextSlideData?.preview || ''
    }

    // Determine if content should be compressed (for songs and announcements)
    const shouldCompress =
      nextSlideData?.contentType === 'song' ||
      nextSlideData?.contentType === 'announcement'

    // Get icon with background for content type
    const getContentTypeIcon = () => {
      const containerSize = labelHeight * 1.2
      const iconSize = containerSize * 0.5

      const iconConfigs: Record<
        string,
        { icon: React.ReactNode; bgColor: string; iconColor: string }
      > = {
        song: {
          icon: <Music size={iconSize} />,
          bgColor: 'rgba(99, 102, 241, 0.2)', // indigo
          iconColor: 'rgb(99, 102, 241)',
        },
        announcement: {
          icon: <Megaphone size={iconSize} />,
          bgColor: 'rgba(249, 115, 22, 0.2)', // orange
          iconColor: 'rgb(249, 115, 22)',
        },
        versete_tineri: {
          icon: <User size={iconSize} />,
          bgColor: 'rgba(34, 197, 94, 0.2)', // green
          iconColor: 'rgb(34, 197, 94)',
        },
        bible_passage: {
          icon: <Book size={iconSize} />,
          bgColor: 'rgba(20, 184, 166, 0.2)', // teal
          iconColor: 'rgb(20, 184, 166)',
        },
      }

      const config = nextSlideData?.contentType
        ? iconConfigs[nextSlideData.contentType]
        : null
      if (!config) return null

      return (
        <div
          style={{
            width: containerSize,
            height: containerSize,
            borderRadius: '50%',
            backgroundColor: config.bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: config.iconColor,
            flexShrink: 0,
            marginRight: gap,
            marginTop: gap * 0.5,
          }}
        >
          {config.icon}
        </div>
      )
    }

    const icon = getContentTypeIcon()
    const iconWidth = icon ? labelHeight * 1.4 : 0

    // Get section background based on content type to make it pop
    const getSectionBackground = (): React.CSSProperties => {
      const backgroundColors: Record<string, string> = {
        song: 'rgba(99, 102, 241, 0.15)', // indigo
        announcement: 'rgba(249, 115, 22, 0.15)', // orange
        versete_tineri: 'rgba(34, 197, 94, 0.15)', // green
        bible_passage: 'rgba(20, 184, 166, 0.15)', // teal
      }

      const bgColor = nextSlideData?.contentType
        ? backgroundColors[nextSlideData.contentType]
        : null

      if (bgColor) {
        return { backgroundColor: bgColor }
      }
      return getBackgroundCSS(ns.background)
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
          ...getSectionBackground(),
        }}
      >
        <div
          style={{
            height: labelHeight,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: gap,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
            <TextContent
              content={getLabelText()}
              style={{
                ...ns.labelStyle,
                maxFontSize: ns.labelStyle.maxFontSize * fontScale,
                minFontSize: (ns.labelStyle.minFontSize ?? 12) * fontScale,
                // Always compress label since it may include title
                compressLines: true,
                lineSeparator: ns.labelStyle.lineSeparator ?? 'space',
              }}
              containerWidth={
                scaledBounds.width - padding * 2 - iconWidth - gap
              }
              containerHeight={labelHeight}
            />
          </div>
          {icon}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <TextContent
            content={getContentText()}
            style={{
              ...ns.contentStyle,
              // Use 1.5x bigger font for versete_tineri
              maxFontSize:
                ns.contentStyle.maxFontSize *
                fontScale *
                (nextSlideData?.contentType === 'versete_tineri' ? 1.5 : 1),
              minFontSize:
                (ns.contentStyle.minFontSize ?? 12) *
                fontScale *
                (nextSlideData?.contentType === 'versete_tineri' ? 1.5 : 1),
              compressLines: shouldCompress,
              lineSeparator: ns.contentStyle.lineSeparator ?? 'space',
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

  // Render screen share preview placeholder
  const renderScreenSharePreview = () => {
    if (contentType !== 'screen_share') return null

    const iconSize = Math.min(containerWidth, containerHeight) * 0.15

    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        }}
      >
        <div
          style={{
            width: iconSize * 2,
            height: iconSize * 2,
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MonitorPlay size={iconSize} style={{ color: 'rgb(59, 130, 246)' }} />
        </div>
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: Math.max(14, containerWidth * 0.025),
            fontWeight: 500,
          }}
        >
          Screen Share Active
        </span>
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
      {renderMainText()}
      {renderContentText()}
      {renderReferenceText()}
      {renderPersonLabel()}
      {renderClock()}
      {renderNextSlideSection()}
      {renderScreenSharePreview()}
    </div>
  )
}
