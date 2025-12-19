import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { getTextStyleCSS } from './utils/styleUtils'
import type { TextStyle } from '../../types'

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

interface TextContentProps {
  content: string
  style: TextStyle
  containerWidth: number
  containerHeight: number
  padding?: number
  isHtml?: boolean
}

export function TextContent({
  content,
  style,
  containerWidth,
  containerHeight,
  padding = 0,
  isHtml = false,
}: TextContentProps) {
  const textRef = useRef<HTMLDivElement>(null)
  const [calculatedFontSize, setCalculatedFontSize] = useState<number | null>(
    null,
  )
  const prevContentRef = useRef<string>(content)

  // Convert HTML to plain text if needed
  const processedContent = useMemo(() => {
    return isHtml ? convertHtmlToText(content) : content
  }, [content, isHtml])

  // Track if content changed THIS render cycle (for immediate hiding)
  const contentChangedThisRender = prevContentRef.current !== content

  // Reset font size calculation when content changes to prevent flash
  if (contentChangedThisRender) {
    prevContentRef.current = content
    if (calculatedFontSize !== null && style.autoScale) {
      setCalculatedFontSize(null)
    }
  }

  // Auto-scale text using single-pass ratio calculation
  useLayoutEffect(() => {
    if (!style.autoScale) {
      setCalculatedFontSize(style.maxFontSize)
      return
    }

    if (!textRef.current) {
      return
    }

    const textElement = textRef.current
    const spanElement = textElement.querySelector('span')
    if (!spanElement) {
      setCalculatedFontSize(style.maxFontSize)
      return
    }

    const maxWidth = containerWidth - padding * 2
    const maxHeight = containerHeight - padding * 2

    if (maxWidth <= 0 || maxHeight <= 0) {
      return
    }

    // Set to max size for measurement (element is hidden, so user won't see this)
    textElement.style.fontSize = `${style.maxFontSize}px`
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
    processedContent,
    style.autoScale,
    style.maxFontSize,
    style.minFontSize,
    padding,
    containerWidth,
    containerHeight,
  ])

  // Determine if ready to show
  const isReady =
    !contentChangedThisRender &&
    (calculatedFontSize !== null || !style.autoScale)
  const fontSize = calculatedFontSize ?? style.maxFontSize

  const textStyles: React.CSSProperties = {
    ...getTextStyleCSS(style),
    fontSize: `${fontSize}px`,
    padding,
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
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    visibility: isReady ? 'visible' : 'hidden',
  }

  return (
    <div ref={textRef} style={textStyles}>
      <span className="w-full">{processedContent}</span>
    </div>
  )
}
