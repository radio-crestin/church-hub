import { useLayoutEffect, useMemo, useRef } from 'react'

import { AnimatedElement } from './AnimatedElement'
import { calculatePixelBounds, getTextStyleCSS } from './utils/styleUtils'
import { compressTextLinesWithFit } from './utils/textProcessing'
import type {
  PersonLabelConfig,
  ReferenceTextConfig,
  TextElementConfig,
} from '../../types'

type TextConfig = TextElementConfig | ReferenceTextConfig | PersonLabelConfig

/**
 * Converts HTML content to plain text with newlines.
 * Replaces block elements like <p> with newlines and decodes HTML entities.
 * This ensures auto-scaling works correctly (no margin issues from block elements).
 */
function convertHtmlToText(html: string): string {
  return (
    html
      // Replace </p><p> with newline (paragraph transitions)
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
      // Replace <br> tags with newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove opening block tags
      .replace(/<(p|div|h[1-6])[^>]*>/gi, '')
      // Replace closing block tags with newline
      .replace(/<\/(p|div|h[1-6])>/gi, '\n')
      // Remove any remaining HTML tags
      .replace(/<[^>]*>/g, '')
      // Decode common HTML entities
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      // Clean up multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/**
 * Calculate optimal font size synchronously using a measurement element.
 * Returns the font size and processed content.
 */
function calculateFontSize(
  measureElement: HTMLDivElement,
  content: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSize: number,
  minFontSize: number,
  autoScale: boolean,
  compressLines: boolean,
  lineSeparator: 'space' | 'dash' | 'pipe',
): { fontSize: number; processedContent: string } {
  const spanElement = measureElement.querySelector('span')
  if (!spanElement || maxWidth <= 0 || maxHeight <= 0) {
    return { fontSize: maxFontSize, processedContent: content }
  }

  // Set to max size for measurement
  measureElement.style.fontSize = `${maxFontSize}px`
  measureElement.style.overflow = 'visible'
  measureElement.style.width = 'auto'
  measureElement.style.height = 'auto'
  measureElement.style.whiteSpace = 'pre-wrap'

  // Handle line compression with fit checking
  let finalContent = content
  if (compressLines) {
    const measureWidth = (text: string) => {
      spanElement.textContent = text
      return spanElement.offsetWidth
    }
    finalContent = compressTextLinesWithFit(
      content,
      lineSeparator,
      measureWidth,
      maxWidth,
      0.7, // 70% threshold
    )
  }

  // Update the span with final content and measure
  spanElement.textContent = finalContent

  if (!autoScale) {
    return { fontSize: maxFontSize, processedContent: finalContent }
  }

  // Force reflow and measure
  const contentWidth = spanElement.offsetWidth
  const contentHeight = spanElement.offsetHeight

  // Calculate scale ratio
  const widthRatio = maxWidth / contentWidth
  const heightRatio = maxHeight / contentHeight
  const ratio = Math.min(widthRatio, heightRatio, 1) // Don't scale up beyond max

  // Calculate final font size
  const finalSize = Math.max(Math.floor(maxFontSize * ratio), minFontSize)

  return { fontSize: finalSize, processedContent: finalContent }
}

interface TextElementProps {
  config: TextConfig
  content: string
  screenWidth: number
  screenHeight: number
  scale: number
  isVisible?: boolean
  isHtml?: boolean
  contentKey?: string // Key to identify content for caching
}

// Cache for font calculations to avoid recalculating on every render
interface FontCache {
  content: string
  width: number
  height: number
  maxFontSize: number
  minFontSize: number
  autoScale: boolean
  compressLines: boolean
  lineSeparator: string
  result: { fontSize: number; processedContent: string }
}

export function TextElement({
  config,
  content,
  screenWidth,
  screenHeight,
  scale,
  isVisible = true,
  isHtml = false,
  contentKey,
}: TextElementProps) {
  const textRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  // Cache the last calculation to avoid recalculating when nothing changed
  const cacheRef = useRef<FontCache | null>(null)

  // Convert HTML to plain text
  const baseContent = useMemo(() => {
    return isHtml ? convertHtmlToText(content) : content
  }, [content, isHtml])

  // Get optional properties with defaults
  const animationIn = 'animationIn' in config ? config.animationIn : undefined
  const animationOut =
    'animationOut' in config ? config.animationOut : undefined
  const slideTransitionIn =
    'slideTransitionIn' in config ? config.slideTransitionIn : undefined
  const slideTransitionOut =
    'slideTransitionOut' in config ? config.slideTransitionOut : undefined

  // Calculate pixel bounds in native screen coordinates
  const bounds = calculatePixelBounds(
    config.constraints,
    config.size,
    screenWidth,
    screenHeight,
  )

  // Scaled dimensions for display
  const scaledBounds = {
    x: bounds.x * scale,
    y: bounds.y * scale,
    width: bounds.width * scale,
    height: bounds.height * scale,
  }

  // Use native dimensions for auto-scale calculations
  const size = { width: bounds.width, height: bounds.height }

  // Extract style config for cache comparison
  const maxFontSize = config.style.maxFontSize
  const minFontSize = config.style.minFontSize ?? 12
  const autoScale = config.style.autoScale
  const compressLines = config.style.compressLines ?? false
  const lineSeparator = config.style.lineSeparator ?? 'space'

  // Check if we can use cached result
  const cache = cacheRef.current
  const canUseCache =
    cache !== null &&
    cache.content === baseContent &&
    cache.width === size.width &&
    cache.height === size.height &&
    cache.maxFontSize === maxFontSize &&
    cache.minFontSize === minFontSize &&
    cache.autoScale === autoScale &&
    cache.compressLines === compressLines &&
    cache.lineSeparator === lineSeparator

  // Get cached or default values for initial render
  let calculatedFontSize = canUseCache ? cache.result.fontSize : maxFontSize
  let processedContent = canUseCache
    ? cache.result.processedContent
    : baseContent

  // Use layout effect to calculate font size synchronously before paint
  // This runs BEFORE the browser paints, ensuring no flash
  useLayoutEffect(() => {
    if (!measureRef.current) return

    // Skip if cache is valid
    if (canUseCache) return

    const result = calculateFontSize(
      measureRef.current,
      baseContent,
      size.width,
      size.height,
      maxFontSize,
      minFontSize,
      autoScale,
      compressLines,
      lineSeparator,
    )

    // Update cache
    cacheRef.current = {
      content: baseContent,
      width: size.width,
      height: size.height,
      maxFontSize,
      minFontSize,
      autoScale,
      compressLines,
      lineSeparator,
      result,
    }

    // Apply calculated values directly to DOM (no state update = no re-render)
    if (textRef.current) {
      const scaledFontSize = result.fontSize * scale
      textRef.current.style.fontSize = `${scaledFontSize}px`
      const spanElement = textRef.current.querySelector('span')
      if (spanElement) {
        spanElement.textContent = result.processedContent
      }
    }
  }, [
    baseContent,
    size.width,
    size.height,
    maxFontSize,
    minFontSize,
    autoScale,
    compressLines,
    lineSeparator,
    scale,
    canUseCache,
  ])

  // Apply scale to font size for display
  const scaledFontSize = calculatedFontSize * scale

  const textStyles: React.CSSProperties = {
    ...getTextStyleCSS(config.style),
    fontSize: `${scaledFontSize}px`,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems:
      config.style.verticalAlignment === 'top'
        ? 'flex-start'
        : config.style.verticalAlignment === 'bottom'
          ? 'flex-end'
          : 'center',
    justifyContent:
      config.style.alignment === 'center'
        ? 'center'
        : config.style.alignment === 'right'
          ? 'flex-end'
          : 'flex-start', // 'left' and 'justify' both use flex-start
    overflow: 'hidden',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
  }

  // Hidden measurement element styles - same font properties but invisible
  const measureStyles: React.CSSProperties = {
    ...getTextStyleCSS(config.style),
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    // Don't constrain size during measurement
    width: 'auto',
    height: 'auto',
    whiteSpace: 'pre-wrap',
  }

  // Use pixel positioning with scaled values
  const containerStyles: React.CSSProperties = {
    position: 'absolute',
    left: scaledBounds.x,
    top: scaledBounds.y,
    width: scaledBounds.width,
    height: scaledBounds.height,
  }

  return (
    <AnimatedElement
      animationIn={animationIn}
      animationOut={animationOut}
      slideTransitionIn={slideTransitionIn}
      slideTransitionOut={slideTransitionOut}
      isVisible={isVisible}
      contentKey={contentKey}
      style={containerStyles}
    >
      {/* Hidden measurement element */}
      <div ref={measureRef} style={measureStyles} aria-hidden="true">
        <span>{baseContent}</span>
      </div>
      {/* Visible text element */}
      <div ref={textRef} style={textStyles}>
        <span className="w-full">{processedContent}</span>
      </div>
    </AnimatedElement>
  )
}
