import { useLayoutEffect, useRef, useState } from 'react'

import {
  calculatePixelBounds,
  getBackgroundCSS,
  getTextStyleCSS,
} from './utils/styleUtils'
import { compressLines } from './utils/textProcessing'
import type {
  ContentType,
  NextSlideSectionConfig,
  TextStyle,
} from '../../types'

interface NextSlideData {
  contentType: ContentType
  preview: string
}

interface NextSlideSectionProps {
  config: NextSlideSectionConfig
  nextSlideData?: NextSlideData
  screenWidth: number
  screenHeight: number
}

/**
 * Renders text with full TextStyle support (auto-scaling, compression, alignment, etc.)
 */
function StyledText({
  text,
  style,
  containerWidth,
  containerHeight,
}: {
  text: string
  style: TextStyle
  containerWidth: number
  containerHeight: number
}) {
  const textRef = useRef<HTMLDivElement>(null)
  const [calculatedFontSize, setCalculatedFontSize] = useState<number | null>(
    null,
  )
  const prevTextRef = useRef<string>(text)

  // Process text with compression if enabled
  const processedText = style.compressLines
    ? compressLines(text, style.lineSeparator ?? 'space')
    : text

  // Track if content changed this render cycle
  const textChangedThisRender = prevTextRef.current !== text

  if (textChangedThisRender) {
    prevTextRef.current = text
    if (calculatedFontSize !== null && style.autoScale) {
      setCalculatedFontSize(null)
    }
  }

  // Auto-scale text
  useLayoutEffect(() => {
    if (!textRef.current) return

    const textElement = textRef.current
    const spanElement = textElement.querySelector('span')
    if (!spanElement) {
      if (!style.autoScale) {
        setCalculatedFontSize(style.maxFontSize)
      }
      return
    }

    const maxWidth = containerWidth
    const maxHeight = containerHeight

    if (maxWidth <= 0 || maxHeight <= 0) return

    if (!style.autoScale) {
      setCalculatedFontSize(style.maxFontSize)
      return
    }

    // Set to max size for measurement
    textElement.style.fontSize = `${style.maxFontSize}px`
    textElement.style.overflow = 'visible'
    textElement.style.width = 'auto'
    textElement.style.height = 'auto'
    textElement.style.whiteSpace = style.fitLineToWidth ? 'pre' : 'pre-wrap'

    // Force reflow and measure
    const contentWidth = spanElement.offsetWidth
    const contentHeight = spanElement.offsetHeight

    // Calculate scale ratio
    const widthRatio = maxWidth / contentWidth
    const heightRatio = maxHeight / contentHeight
    const ratio = Math.min(widthRatio, heightRatio, 1)

    const minFontSize = style.minFontSize ?? 12
    const finalSize = Math.max(
      Math.floor(style.maxFontSize * ratio),
      minFontSize,
    )

    // Restore styles
    textElement.style.overflow = 'hidden'
    textElement.style.width = '100%'
    textElement.style.height = '100%'

    setCalculatedFontSize(finalSize)
  }, [
    processedText,
    style.autoScale,
    style.maxFontSize,
    style.minFontSize,
    style.fitLineToWidth,
    containerWidth,
    containerHeight,
  ])

  const isReady =
    !textChangedThisRender && (calculatedFontSize !== null || !style.autoScale)
  const fontSize = calculatedFontSize ?? style.maxFontSize

  const textStyles: React.CSSProperties = {
    ...getTextStyleCSS(style),
    fontSize: `${fontSize}px`,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems:
      style.verticalAlignment === 'top'
        ? 'flex-start'
        : style.verticalAlignment === 'bottom'
          ? 'flex-end'
          : 'center',
    justifyContent:
      style.alignment === 'center'
        ? 'center'
        : style.alignment === 'right'
          ? 'flex-end'
          : 'flex-start',
    overflow: 'hidden',
    wordWrap: style.fitLineToWidth ? 'normal' : 'break-word',
    whiteSpace: style.fitLineToWidth ? 'pre' : 'pre-wrap',
    visibility: isReady ? 'visible' : 'hidden',
  }

  return (
    <div ref={textRef} style={textStyles}>
      <span>{processedText}</span>
    </div>
  )
}

export function NextSlideSection({
  config,
  nextSlideData,
  screenWidth,
  screenHeight,
}: NextSlideSectionProps) {
  if (!config.enabled || config.hidden) {
    return null
  }

  // Use constraints-based positioning
  const bounds = calculatePixelBounds(
    config.constraints,
    config.size,
    screenWidth,
    screenHeight,
  )

  const containerStyles: React.CSSProperties = {
    position: 'absolute',
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
    ...getBackgroundCSS(config.background),
    display: 'flex',
    alignItems: 'stretch',
    gap: '16px',
    padding: '8px 24px',
  }

  // Calculate space allocation - label takes what it needs, content gets the rest
  const labelWidth = Math.min(bounds.width * 0.3, 200) // Max 30% or 200px for label
  const contentWidth = bounds.width - labelWidth - 16 - 48 // Subtract gap and padding

  return (
    <div style={containerStyles}>
      <div style={{ width: labelWidth, flexShrink: 0 }}>
        <StyledText
          text={config.labelText}
          style={config.labelStyle}
          containerWidth={labelWidth}
          containerHeight={bounds.height - 16}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <StyledText
          text={nextSlideData?.preview || '—'}
          style={config.contentStyle}
          containerWidth={contentWidth}
          containerHeight={bounds.height - 16}
        />
      </div>
    </div>
  )
}
