import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { AnimatedElement } from './AnimatedElement'
import {
  calculateConstraintStyles,
  calculatePixelBounds,
  getTextStyleCSS,
} from './utils/styleUtils'
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

interface TextElementProps {
  config: TextConfig
  content: string
  screenWidth: number
  screenHeight: number
  scale?: number
  isVisible?: boolean
  isHtml?: boolean
}

export function TextElement({
  config,
  content,
  screenWidth,
  screenHeight,
  scale = 1,
  isVisible = true,
  isHtml = false,
}: TextElementProps) {
  const textRef = useRef<HTMLDivElement>(null)
  // Use null to indicate "not yet calculated" - text will be hidden until ready
  const [calculatedFontSize, setCalculatedFontSize] = useState<number | null>(
    null,
  )
  // Track previous content to detect changes
  const prevContentRef = useRef<string>(content)

  // Convert HTML to plain text if needed - this ensures auto-scaling works correctly
  const processedContent = useMemo(() => {
    return isHtml ? convertHtmlToText(content) : content
  }, [content, isHtml])

  // Track if content changed THIS render cycle (for immediate hiding)
  const contentChangedThisRender = prevContentRef.current !== content

  // Reset font size calculation when content changes to prevent flash
  if (contentChangedThisRender) {
    prevContentRef.current = content
    if (calculatedFontSize !== null && config.style.autoScale) {
      setCalculatedFontSize(null)
    }
  }

  // Get optional properties with defaults
  const padding = 'padding' in config ? (config.padding ?? 0) : 0
  const animationIn = 'animationIn' in config ? config.animationIn : undefined
  const animationOut =
    'animationOut' in config ? config.animationOut : undefined

  // Calculate pixel bounds for sizing (needed for auto-scale calculations)
  const bounds = calculatePixelBounds(
    config.constraints,
    config.size,
    screenWidth,
    screenHeight,
  )

  // Calculate CSS styles from constraints
  const constraintStyles = calculateConstraintStyles(
    config.constraints,
    config.size,
    screenWidth,
    screenHeight,
  )

  // Create size object for compatibility with existing code
  const size = { width: bounds.width, height: bounds.height }

  // Auto-scale text using single-pass ratio calculation
  useLayoutEffect(() => {
    if (!config.style.autoScale) {
      setCalculatedFontSize(config.style.maxFontSize)
      return
    }

    if (!textRef.current) {
      return
    }

    const textElement = textRef.current
    const spanElement = textElement.querySelector('span')
    if (!spanElement) {
      setCalculatedFontSize(config.style.maxFontSize)
      return
    }

    const maxWidth = size.width - padding * 2
    const maxHeight = size.height - padding * 2

    if (maxWidth <= 0 || maxHeight <= 0) {
      return
    }

    // Set to max size for measurement (element is hidden, so user won't see this)
    textElement.style.fontSize = `${config.style.maxFontSize}px`
    textElement.style.overflow = 'visible'
    textElement.style.width = 'auto'
    textElement.style.height = 'auto'
    textElement.style.whiteSpace = 'pre-wrap'

    // Force reflow and measure once
    const contentWidth = spanElement.offsetWidth
    const contentHeight = spanElement.offsetHeight

    // Calculate scale ratio
    const widthRatio = maxWidth / contentWidth
    const heightRatio = maxHeight / contentHeight
    const ratio = Math.min(widthRatio, heightRatio, 1) // Don't scale up beyond max

    // Calculate final font size using minFontSize from config (default 12px)
    const minFontSize = config.style.minFontSize ?? 12
    const finalSize = Math.max(
      Math.floor(config.style.maxFontSize * ratio),
      minFontSize,
    )

    // Restore styles
    textElement.style.overflow = 'hidden'
    textElement.style.width = '100%'
    textElement.style.height = '100%'

    setCalculatedFontSize(finalSize)
  }, [
    processedContent,
    config.style.autoScale,
    config.style.maxFontSize,
    config.style.minFontSize,
    padding,
    size.width,
    size.height,
  ])

  // Determine if ready to show - hide if content changed this render (old font size)
  const isReady =
    !contentChangedThisRender &&
    (calculatedFontSize !== null || !config.style.autoScale)
  const fontSize = calculatedFontSize ?? config.style.maxFontSize

  const textStyles: React.CSSProperties = {
    ...getTextStyleCSS(config.style),
    fontSize: `${fontSize}px`,
    padding,
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
          : 'flex-start',
    overflow: 'hidden',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    visibility: isReady ? 'visible' : 'hidden', // Hide until calculated
  }

  const containerStyles: React.CSSProperties = {
    ...constraintStyles,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: 'top left',
  }

  return (
    <AnimatedElement
      animationIn={animationIn}
      animationOut={animationOut}
      isVisible={isVisible}
      style={containerStyles}
    >
      <div ref={textRef} style={textStyles}>
        <span className="w-full">{processedContent}</span>
      </div>
    </AnimatedElement>
  )
}
