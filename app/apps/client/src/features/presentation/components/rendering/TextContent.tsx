import { useLayoutEffect, useMemo, useRef } from 'react'

import {
  findOptimalFontSize,
  findOptimalFontSizePerLine,
} from './utils/fontFitting'
import { getTextStyleCSS } from './utils/styleUtils'
import { compressLines } from './utils/textProcessing'
import type { TextStyle } from '../../types'

/**
 * Represents a text segment with optional highlight color.
 */
interface TextSegment {
  text: string
  highlightColor?: string
}

/**
 * Decodes common HTML entities in a string.
 */
function decodeHtmlEntities(text: string): string {
  return text
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
}

/**
 * Preprocesses HTML to normalize block elements into newlines.
 */
function normalizeBlockElements(html: string): string {
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
  )
}

/**
 * Parses HTML content into segments, preserving <mark> elements with their colors.
 * Returns an array of text segments, each with optional highlight color.
 */
function parseHtmlToSegments(html: string): TextSegment[] {
  // First normalize block elements
  const normalized = normalizeBlockElements(html)

  const segments: TextSegment[] = []

  // Match <mark> tags with their attributes and content
  // Pattern captures: full match, attributes, inner content
  const markRegex = /<mark([^>]*)>(.*?)<\/mark>/gis

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = markRegex.exec(normalized)) !== null) {
    // Add text before this mark tag (if any)
    if (match.index > lastIndex) {
      const textBefore = normalized.slice(lastIndex, match.index)
      const cleanedText = decodeHtmlEntities(textBefore.replace(/<[^>]*>/g, ''))
      if (cleanedText) {
        segments.push({ text: cleanedText })
      }
    }

    // Extract color from mark attributes
    const attributes = match[1]
    const content = match[2]

    // Try to get color from data-color attribute or style
    let color: string | undefined
    const dataColorMatch = attributes.match(/data-color=["']([^"']+)["']/)
    if (dataColorMatch) {
      color = dataColorMatch[1]
    } else {
      const styleMatch = attributes.match(
        /style=["'][^"']*background-color:\s*([^;"']+)/i,
      )
      if (styleMatch) {
        color = styleMatch[1].trim()
      }
    }

    // Clean the content inside mark (remove any nested HTML tags)
    const cleanedContent = decodeHtmlEntities(content.replace(/<[^>]*>/g, ''))
    if (cleanedContent) {
      segments.push({ text: cleanedContent, highlightColor: color })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text after the last mark tag
  if (lastIndex < normalized.length) {
    const remainingText = normalized.slice(lastIndex)
    const cleanedText = decodeHtmlEntities(
      remainingText.replace(/<[^>]*>/g, ''),
    )
    if (cleanedText) {
      segments.push({ text: cleanedText })
    }
  }

  // If no segments were created (no mark tags found), return the whole text as one segment
  if (segments.length === 0) {
    const cleanedText = decodeHtmlEntities(normalized.replace(/<[^>]*>/g, ''))
    if (cleanedText) {
      segments.push({ text: cleanedText })
    }
  }

  return segments
}

/**
 * Converts HTML content to plain text with newlines.
 * Replaces block elements like <p> with newlines and decodes HTML entities.
 * This ensures auto-scaling works correctly (no margin issues from block elements).
 */
function convertHtmlToText(html: string): string {
  const normalized = normalizeBlockElements(html)
  return decodeHtmlEntities(normalized.replace(/<[^>]*>/g, ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface TextContentProps {
  content: string
  style: TextStyle
  containerWidth: number
  containerHeight: number
  isHtml?: boolean
}

/**
 * Applies line compression to segments while preserving highlight information.
 */
function compressSegments(
  segments: TextSegment[],
  separator: 'space' | 'slash',
): TextSegment[] {
  // First, join all segments into one string to apply compression
  const fullText = segments.map((s) => s.text).join('')
  const compressedText = compressLines(fullText, separator)

  // If no highlights exist, return simple compressed text
  const hasHighlights = segments.some((s) => s.highlightColor)
  if (!hasHighlights) {
    return [{ text: compressedText }]
  }

  // For highlighted content, we need to map the compression back to segments
  // This is complex because compression joins lines. For now, we'll
  // rebuild segments by tracking character positions.
  const result: TextSegment[] = []
  let compressedPos = 0

  for (const segment of segments) {
    const segmentLength = segment.text.length
    let segmentText = ''

    // Find where this segment's text appears in the compressed output
    for (
      let i = 0;
      i < segmentLength && compressedPos < compressedText.length;
      i++
    ) {
      const origChar = segment.text[i]
      const compChar = compressedText[compressedPos]

      // Handle newlines that got converted to separators
      if (origChar === '\n') {
        // Skip the newline, the separator is already in compressedText
        continue
      }

      if (origChar === compChar) {
        segmentText += compChar
        compressedPos++
      }
    }

    if (segmentText) {
      result.push({ text: segmentText, highlightColor: segment.highlightColor })
    }
  }

  // Add any remaining compressed text
  if (compressedPos < compressedText.length) {
    const remaining = compressedText.slice(compressedPos)
    if (remaining) {
      // Attach to last segment if it exists, otherwise create new
      if (result.length > 0) {
        result[result.length - 1].text += remaining
      } else {
        result.push({ text: remaining })
      }
    }
  }

  return result
}

/**
 * Renders text segments with optional highlight colors.
 */
function renderSegments(segments: TextSegment[]): React.ReactNode {
  if (segments.length === 0) {
    return null
  }

  // If no highlights, just return plain text
  const hasHighlights = segments.some((s) => s.highlightColor)
  if (!hasHighlights) {
    return segments.map((s) => s.text).join('')
  }

  // Render segments with highlights as spans
  return segments.map((segment, index) => {
    if (segment.highlightColor) {
      return (
        <span
          key={index}
          style={{
            backgroundColor: segment.highlightColor,
            borderRadius: '2px',
            padding: '0 2px',
          }}
        >
          {segment.text}
        </span>
      )
    }
    return <span key={index}>{segment.text}</span>
  })
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
  fitLineToWidth: boolean
  lineHeight: number
  result: { fontSize: number; processedSegments: TextSegment[] }
}

export function TextContent({
  content,
  style,
  containerWidth,
  containerHeight,
  isHtml = false,
}: TextContentProps) {
  const textRef = useRef<HTMLDivElement>(null)
  // Cache the last calculation to avoid recalculating when nothing changed
  const cacheRef = useRef<FontCache | null>(null)

  // Convert HTML to plain text for font size calculation
  const baseContent = useMemo(() => {
    return isHtml ? convertHtmlToText(content) : content
  }, [content, isHtml])

  // Extract style config
  const maxFontSize = style.maxFontSize
  const minFontSize = style.minFontSize ?? 12
  const autoScale = style.autoScale
  const shouldCompressLines = style.compressLines ?? false
  const lineSeparator = style.lineSeparator ?? 'space'
  const fitLineToWidth = style.fitLineToWidth ?? false
  const lineHeight = style.lineHeight ?? 1.3

  // Parse HTML to segments and apply compression synchronously during render
  // This ensures compressed content is displayed immediately, not after a layout effect
  const { processedContent, processedSegments } = useMemo(() => {
    const baseSegments = isHtml
      ? parseHtmlToSegments(content)
      : [{ text: content }]

    if (shouldCompressLines) {
      const compressedContent = compressLines(
        baseContent,
        lineSeparator as 'space',
      )
      const compressedSegments = compressSegments(
        baseSegments,
        lineSeparator as 'space',
      )
      return {
        processedContent: compressedContent,
        processedSegments: compressedSegments,
      }
    }

    return { processedContent: baseContent, processedSegments: baseSegments }
  }, [content, isHtml, baseContent, shouldCompressLines, lineSeparator])

  // Check if we can use cached result for font size
  const cache = cacheRef.current
  const canUseCache =
    cache !== null &&
    cache.content === processedContent &&
    cache.width === containerWidth &&
    cache.height === containerHeight &&
    cache.maxFontSize === maxFontSize &&
    cache.minFontSize === minFontSize &&
    cache.autoScale === autoScale &&
    cache.compressLines === shouldCompressLines &&
    cache.lineSeparator === lineSeparator &&
    cache.fitLineToWidth === fitLineToWidth &&
    cache.lineHeight === lineHeight

  // Get cached or default font size for initial render
  const calculatedFontSize = canUseCache ? cache.result.fontSize : maxFontSize

  // Use layout effect to calculate font size synchronously before paint
  // This runs BEFORE the browser paints, ensuring no flash
  // Note: Line compression is done in useMemo above, so processedContent is already compressed
  useLayoutEffect(() => {
    if (!textRef.current) return

    // Skip if cache is valid
    if (canUseCache) return

    const textElement = textRef.current
    const maxWidth = containerWidth
    const maxHeight = containerHeight

    if (maxWidth <= 0 || maxHeight <= 0) return

    let fontSize = maxFontSize
    if (autoScale) {
      // Use binary search for accurate font fitting
      const result = fitLineToWidth
        ? findOptimalFontSizePerLine({
            measureElement: textElement,
            text: processedContent,
            maxWidth,
            maxHeight,
            minFontSize,
            maxFontSize,
            lineHeight,
          })
        : findOptimalFontSize({
            measureElement: textElement,
            text: processedContent,
            maxWidth,
            maxHeight,
            minFontSize,
            maxFontSize,
            lineHeight,
          })
      fontSize = result.fontSize
    }

    // Update cache (for font size only - segments are handled by useMemo)
    cacheRef.current = {
      content: processedContent,
      width: containerWidth,
      height: containerHeight,
      maxFontSize,
      minFontSize,
      autoScale,
      compressLines: shouldCompressLines,
      lineSeparator,
      fitLineToWidth,
      lineHeight,
      result: { fontSize, processedSegments },
    }

    // Apply calculated values directly to DOM (no state update = no re-render)
    if (textRef.current) {
      textRef.current.style.fontSize = `${fontSize}px`
    }
  }, [
    processedContent,
    processedSegments,
    containerWidth,
    containerHeight,
    maxFontSize,
    minFontSize,
    autoScale,
    shouldCompressLines,
    lineSeparator,
    fitLineToWidth,
    lineHeight,
    canUseCache,
  ])

  const textStyles: React.CSSProperties = {
    ...getTextStyleCSS(style),
    fontSize: `${calculatedFontSize}px`,
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
  }

  return (
    <div ref={textRef} style={textStyles}>
      {renderSegments(processedSegments)}
    </div>
  )
}
