import { useLayoutEffect, useMemo, useRef } from 'react'

import { type AnimationConfig, useSlideAnimation } from './useSlideAnimation'
import { compressLines } from './utils/textProcessing'
import type {
  TextStyle,
  AnimationConfig as TypesAnimationConfig,
} from '../../types'

/**
 * Decodes HTML entities and normalizes text
 */
function normalizeText(html: string, isHtml: boolean): string {
  if (!isHtml) return html

  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(p|div|h[1-6])[^>]*>/gi, '')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
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
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Calculate font size to fit text in container using binary search.
 * Sets the element to target width and finds the largest font that fits in height.
 */
function calculateFontSize(
  element: HTMLElement,
  text: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSize: number,
  minFontSize: number,
): number {
  if (!text || maxWidth <= 0 || maxHeight <= 0) {
    return maxFontSize
  }

  // Save original styles
  const originalStyles = {
    fontSize: element.style.fontSize,
    width: element.style.width,
    height: element.style.height,
    overflow: element.style.overflow,
    whiteSpace: element.style.whiteSpace,
    visibility: element.style.visibility,
    wordWrap: element.style.wordWrap,
  }

  // Set up for measurement - use target width so text wraps correctly
  element.style.width = `${maxWidth}px`
  element.style.height = 'auto'
  element.style.overflow = 'visible'
  element.style.whiteSpace = 'pre-wrap'
  element.style.wordWrap = 'break-word'
  element.style.visibility = 'hidden'
  element.textContent = text

  // Binary search for the largest font size that fits
  let low = minFontSize
  let high = maxFontSize
  let bestFit = minFontSize

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    element.style.fontSize = `${mid}px`

    // Measure height at this font size
    const contentHeight = element.scrollHeight

    if (contentHeight <= maxHeight) {
      // This font size fits, try larger
      bestFit = mid
      low = mid + 1
    } else {
      // Too big, try smaller
      high = mid - 1
    }
  }

  // Restore original styles
  element.style.fontSize = originalStyles.fontSize
  element.style.width = originalStyles.width
  element.style.height = originalStyles.height
  element.style.overflow = originalStyles.overflow
  element.style.whiteSpace = originalStyles.whiteSpace
  element.style.wordWrap = originalStyles.wordWrap
  element.style.visibility = originalStyles.visibility

  return bestFit
}

/**
 * Convert TextStyle to CSS properties
 */
function getTextStyles(style: TextStyle): React.CSSProperties {
  const css: React.CSSProperties = {
    fontFamily: style.fontFamily,
    color: style.color,
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    textAlign: style.alignment ?? 'center',
    lineHeight: style.lineHeight ?? 1.3,
  }

  if (style.shadow) {
    css.textShadow = `2px 2px 4px rgba(0, 0, 0, 0.5)`
  }

  return css
}

// Convert types animation config to hook animation config
function toAnimationConfig(
  config?: TypesAnimationConfig,
): AnimationConfig | undefined {
  if (!config) return undefined
  return {
    type: config.type,
    duration: config.duration,
  }
}

interface AnimatedTextProps {
  /** Text content to display */
  content: string
  /** Unique key that changes when content changes (for animation triggers) */
  contentKey: string
  /** Whether the element is visible */
  isVisible: boolean
  /** Text styling */
  style: TextStyle
  /** Container width in pixels */
  width: number
  /** Container height in pixels */
  height: number
  /** Position left in pixels */
  left: number
  /** Position top in pixels */
  top: number
  /** Whether content is HTML */
  isHtml?: boolean
  /** Animation for when content first appears (presentation starts) */
  animationIn?: TypesAnimationConfig
  /** Animation for when content disappears (presentation ends) */
  animationOut?: TypesAnimationConfig
  /** Animation for old content exiting during slide transitions */
  slideTransitionOut?: TypesAnimationConfig
  /** Animation for new content entering during slide transitions */
  slideTransitionIn?: TypesAnimationConfig
}

/**
 * Simplified animated text component.
 * Handles text rendering with auto-scaling and slide transition animations.
 */
export function AnimatedText({
  content,
  contentKey,
  isVisible,
  style,
  width,
  height,
  left,
  top,
  isHtml = false,
  animationIn,
  animationOut,
  slideTransitionOut,
  slideTransitionIn,
}: AnimatedTextProps) {
  const textRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)

  // Normalize text content and apply line compression if enabled
  const normalizedText = useMemo(() => {
    let text = normalizeText(content, isHtml)

    // Apply line compression if enabled in style
    if (style.compressLines) {
      text = compressLines(text, style.lineSeparator ?? 'space')
    }

    return text
  }, [content, isHtml, style.compressLines, style.lineSeparator])

  // Use the slide animation hook
  const {
    displayContent,
    style: animationStyle,
    shouldRender,
  } = useSlideAnimation({
    content: normalizedText,
    contentKey,
    isVisible,
    animationIn: toAnimationConfig(animationIn),
    animationOut: toAnimationConfig(animationOut),
    slideTransitionOut: toAnimationConfig(slideTransitionOut),
    slideTransitionIn: toAnimationConfig(slideTransitionIn),
  })

  // Calculate font size synchronously before paint
  useLayoutEffect(() => {
    if (!measureRef.current || !textRef.current || !shouldRender) return

    const text = typeof displayContent === 'string' ? displayContent : ''
    if (!text) return

    const fontSize = calculateFontSize(
      measureRef.current,
      text,
      width,
      height,
      style.maxFontSize,
      style.minFontSize ?? 12,
    )

    textRef.current.style.fontSize = `${fontSize}px`
  }, [
    displayContent,
    width,
    height,
    style.maxFontSize,
    style.minFontSize,
    shouldRender,
  ])

  if (!shouldRender) {
    return null
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left,
    top,
    width,
    height,
    overflow: 'hidden',
    ...animationStyle,
  }

  const textStyles: React.CSSProperties = {
    ...getTextStyles(style),
    fontSize: `${style.maxFontSize}px`, // Will be overwritten by useLayoutEffect
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
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  }

  // Hidden element for measurement (same font properties as display)
  const measureStyle: React.CSSProperties = {
    ...getTextStyles(style),
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: 'auto',
    height: 'auto',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  }

  return (
    <div style={containerStyle}>
      {/* Hidden measurement element */}
      <div ref={measureRef} style={measureStyle} aria-hidden="true" />
      {/* Visible text */}
      <div ref={textRef} style={textStyles}>
        {displayContent}
      </div>
    </div>
  )
}
