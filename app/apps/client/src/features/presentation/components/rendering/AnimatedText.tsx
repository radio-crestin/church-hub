import { memo, useLayoutEffect, useMemo, useRef } from 'react'

import { type AnimationConfig, useSlideAnimation } from './useSlideAnimation'
import { calculateFontSize } from './utils/calculateFontSize'
import { fitFontSizeToBounds } from './utils/fitFontSizeToBounds'
import { getTextStyles } from './utils/getTextStyles'
import { normalizeText } from './utils/normalizeText'
import { compressLines } from './utils/textProcessing'
import { attachRepetitionMarkers } from '../../../../utils/attachRepetitionMarkers'
import type {
  TextStyle,
  TextStyleRange,
  AnimationConfig as TypesAnimationConfig,
} from '../../types'
import { applyStylesToText } from '../../utils/applyStylesToText'

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
  /** Text style ranges for inline highlighting/styling */
  styleRanges?: TextStyleRange[]
  /**
   * Per-slide font multiplier, applied to the auto-fitted size. Scaling the fit
   * ceiling instead would be invisible on a slide whose text is already limited
   * by the element height, which is most of them.
   */
  contentScale?: number
}

/**
 * Compare two TextStyleRange arrays for equality
 */
function areStyleRangesEqual(
  a: TextStyleRange[] | undefined,
  b: TextStyleRange[] | undefined,
): boolean {
  if (a === b) return true
  if (!a || !b) return a === b
  if (a.length !== b.length) return false
  return a.every(
    (range, i) =>
      range.id === b[i].id &&
      range.start === b[i].start &&
      range.end === b[i].end &&
      range.highlight === b[i].highlight &&
      range.bold === b[i].bold &&
      range.italic === b[i].italic &&
      range.underline === b[i].underline &&
      range.fontScale === b[i].fontScale,
  )
}

/**
 * Custom comparison for AnimatedText props to prevent unnecessary re-renders.
 * Uses deep comparison for styleRanges since it's an array.
 */
function arePropsEqual(
  prevProps: AnimatedTextProps,
  nextProps: AnimatedTextProps,
): boolean {
  // Check simple props
  if (
    prevProps.content !== nextProps.content ||
    prevProps.contentKey !== nextProps.contentKey ||
    prevProps.isVisible !== nextProps.isVisible ||
    prevProps.width !== nextProps.width ||
    prevProps.height !== nextProps.height ||
    prevProps.left !== nextProps.left ||
    prevProps.top !== nextProps.top ||
    prevProps.isHtml !== nextProps.isHtml ||
    prevProps.contentScale !== nextProps.contentScale
  ) {
    return false
  }

  // Check style object (shallow comparison of relevant fields)
  const s1 = prevProps.style
  const s2 = nextProps.style
  if (
    s1.fontFamily !== s2.fontFamily ||
    s1.color !== s2.color ||
    s1.bold !== s2.bold ||
    s1.italic !== s2.italic ||
    s1.underline !== s2.underline ||
    s1.alignment !== s2.alignment ||
    s1.verticalAlignment !== s2.verticalAlignment ||
    s1.lineHeight !== s2.lineHeight ||
    s1.shadow !== s2.shadow ||
    s1.maxFontSize !== s2.maxFontSize ||
    s1.minFontSize !== s2.minFontSize ||
    s1.compressLines !== s2.compressLines ||
    s1.lineSeparator !== s2.lineSeparator
  ) {
    return false
  }

  // Check animation configs (by reference is fine, they're usually stable)
  if (
    prevProps.animationIn !== nextProps.animationIn ||
    prevProps.animationOut !== nextProps.animationOut ||
    prevProps.slideTransitionOut !== nextProps.slideTransitionOut ||
    prevProps.slideTransitionIn !== nextProps.slideTransitionIn
  ) {
    return false
  }

  // Deep compare styleRanges
  return areStyleRangesEqual(prevProps.styleRanges, nextProps.styleRanges)
}

/**
 * Simplified animated text component.
 * Handles text rendering with auto-scaling and slide transition animations.
 * Memoized to prevent re-renders that would clear text selection.
 */
const AnimatedTextInner = memo(function AnimatedText({
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
  styleRanges,
  contentScale = 1,
}: AnimatedTextProps) {
  const textRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)

  // Normalize text content and apply line compression if enabled
  const normalizedText = useMemo(() => {
    let text = attachRepetitionMarkers(normalizeText(content, isHtml))

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

  // While a slide transition plays, the hook keeps showing the OUTGOING text.
  // Everything that decides how that text looks has to travel with it: the
  // incoming slide's size, box and inline runs belong to a different text, and
  // applying them mid-transition resizes and repositions the words that are
  // still fading out. This is what the operator sees as a flash — most visibly
  // at the first and last slide, where the layout switches to the first-slide /
  // last-slide screen config as well.
  const showsCurrentText = displayContent === normalizedText
  const currentRender = {
    contentScale,
    styleRanges,
    style,
    width,
    height,
    left,
    top,
  }
  const previousRenderRef = useRef(currentRender)
  if (showsCurrentText) {
    previousRenderRef.current = currentRender
  }
  const shown = showsCurrentText ? currentRender : previousRenderRef.current
  const displayScale = shown.contentScale
  const displayRanges = shown.styleRanges
  const displayStyle = shown.style

  // Get the final display content - use styled HTML if available
  // Must be before any early returns to maintain hooks order
  const finalDisplayContent = useMemo(() => {
    if (!displayRanges || displayRanges.length === 0) return null
    // Apply styles to the display content
    return applyStylesToText(
      typeof displayContent === 'string' ? displayContent : '',
      displayRanges,
    )
  }, [displayContent, displayRanges])

  // Calculate font size synchronously before paint
  useLayoutEffect(() => {
    if (!measureRef.current || !textRef.current || !shouldRender) return

    const text = typeof displayContent === 'string' ? displayContent : ''
    if (!text) return

    const minFontSize = displayStyle.minFontSize ?? 12
    const fontSize = calculateFontSize(
      measureRef.current,
      text,
      shown.width,
      shown.height,
      displayStyle.maxFontSize,
      minFontSize,
    )

    // The fit measures plain text at the screen's own size; the slide's scale
    // and any enlarged run are applied on top of it and can push the words off
    // the top and bottom of the box, where they are cut off. Holding the scaled
    // size to what the rendered markup still fits into is what keeps the text on
    // the screen.
    textRef.current.style.fontSize = `${fitFontSizeToBounds(
      measureRef.current,
      text,
      finalDisplayContent,
      fontSize * displayScale,
      shown.width,
      shown.height,
      minFontSize,
    )}px`
  }, [
    displayContent,
    finalDisplayContent,
    shown.width,
    shown.height,
    displayStyle.maxFontSize,
    displayStyle.minFontSize,
    // Everything below changes how wide the text measures, so the fit has to be
    // redone when any of it does.
    displayStyle.bold,
    displayStyle.italic,
    displayStyle.fontFamily,
    displayStyle.lineHeight,
    displayRanges,
    displayScale,
    shouldRender,
  ])

  if (!shouldRender) {
    return null
  }

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: shown.left,
    top: shown.top,
    width: shown.width,
    height: shown.height,
    overflow: 'hidden',
    ...animationStyle,
  }

  const textStyles: React.CSSProperties = {
    ...getTextStyles(displayStyle),
    // Already carries the slide's own scale so the very first paint — before
    // the fit runs — is never the plain screen size.
    fontSize: `${displayStyle.maxFontSize * displayScale}px`, // Refined by useLayoutEffect
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems:
      displayStyle.verticalAlignment === 'top'
        ? 'flex-start'
        : displayStyle.verticalAlignment === 'bottom'
          ? 'flex-end'
          : 'center',
    justifyContent:
      displayStyle.alignment === 'center'
        ? 'center'
        : displayStyle.alignment === 'right'
          ? 'flex-end'
          : 'flex-start',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  }

  // Hidden element for measurement (same font properties as display)
  const measureStyle: React.CSSProperties = {
    ...getTextStyles(displayStyle),
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
      {/* Visible text - use dangerouslySetInnerHTML if we have styled content */}
      {finalDisplayContent ? (
        <div ref={textRef} style={textStyles}>
          {/* Wrap in span to prevent flexbox from treating inline elements as flex items */}
          <span dangerouslySetInnerHTML={{ __html: finalDisplayContent }} />
        </div>
      ) : (
        <div ref={textRef} style={textStyles}>
          {displayContent}
        </div>
      )}
    </div>
  )
}, arePropsEqual)

// Export with the expected name
export { AnimatedTextInner as AnimatedText }
