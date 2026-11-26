import { memo, useCallback, useMemo } from 'react'

import { TextLayer, type TextLayerContent } from './TextLayer'
import {
  type SlideAnimationConfig,
  useSlideAnimation,
} from './useSlideAnimation'
import { canMorphText } from './utils/canMorphText'
import { normalizeText } from './utils/normalizeText'
import { compressLines } from './utils/textProcessing'
import { attachRepetitionMarkers } from '../../../../utils/attachRepetitionMarkers'
import type {
  TextStyle,
  TextStyleRange,
  AnimationConfig as TypesAnimationConfig,
} from '../../types'
import { FACTORY_TRANSITIONS } from '../../utils/factoryTransitions'
import type { TokenMode } from '../../utils/tokenizeLine'

// Convert types animation config to hook animation config
function toAnimationConfig(
  config?: TypesAnimationConfig,
): SlideAnimationConfig | undefined {
  if (!config) return undefined
  return {
    type: config.type,
    duration: config.duration,
    easing: config.easing,
  }
}

interface AnimatedTextProps {
  /** Text content to display */
  content: string
  /** Unique key that changes when content changes (for animation triggers) */
  contentKey: string
  /**
   * The slide shares lines with the previous one (usePresentationContent): on
   * this slide change only the changed lines and words animate, if the text
   * keeps its box, style and fitted size. Only a text that is given this
   * (the main text) is drawn word by word; others stay plain runs.
   */
  morphLines?: boolean
  /** How finely a morphing text is cut: `reference` for a Bible reference */
  splitBy?: TokenMode
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
  /**
   * Marks this text as the one live highlights are counted in, and says how
   * many characters the screen put in front of it (a prepended reference).
   * Selections made here are turned into offsets into the text itself, so
   * every screen can place them, whatever it adds around the text.
   */
  styleAnchorOffset?: number
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
    prevProps.morphLines !== nextProps.morphLines ||
    prevProps.splitBy !== nextProps.splitBy ||
    prevProps.isVisible !== nextProps.isVisible ||
    prevProps.width !== nextProps.width ||
    prevProps.height !== nextProps.height ||
    prevProps.left !== nextProps.left ||
    prevProps.top !== nextProps.top ||
    prevProps.isHtml !== nextProps.isHtml ||
    prevProps.contentScale !== nextProps.contentScale ||
    prevProps.styleAnchorOffset !== nextProps.styleAnchorOffset
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
 * Handles text rendering with auto-scaling and slide transition animations:
 * on a slide change the old text fades out on its own layer while the new
 * text fades in, so the new slide shows at once.
 * Memoized to prevent re-renders that would clear text selection.
 */
const AnimatedTextInner = memo(function AnimatedText({
  content,
  contentKey,
  morphLines,
  splitBy = 'words',
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
  styleAnchorOffset,
}: AnimatedTextProps) {
  // Normalize text content and apply line compression if enabled
  const text = useMemo(() => {
    let normalized = attachRepetitionMarkers(normalizeText(content, isHtml))

    // Apply line compression if enabled in style
    if (style.compressLines) {
      normalized = compressLines(normalized, style.lineSeparator ?? 'space')
    }

    return normalized
  }, [content, isHtml, style.compressLines, style.lineSeparator])

  // Everything that decides how the text looks travels with it: a slide that
  // leaves keeps its own size, box and inline runs while the next slide, maybe
  // in the first-slide / last-slide layout, comes in with its own.
  const layerContent = useMemo<TextLayerContent>(
    () => ({
      text,
      style,
      width,
      height,
      left,
      top,
      contentScale,
      styleRanges,
    }),
    [text, style, width, height, left, top, contentScale, styleRanges],
  )

  const canMorph = useCallback(
    (from: TextLayerContent, to: TextLayerContent) =>
      morphLines === true && canMorphText(from, to),
    [morphLines],
  )

  const lineTransitions = useMemo(
    () => ({
      enter:
        toAnimationConfig(slideTransitionIn) ??
        FACTORY_TRANSITIONS.slideTransitionIn,
      exit:
        toAnimationConfig(slideTransitionOut) ??
        FACTORY_TRANSITIONS.slideTransitionOut,
    }),
    [slideTransitionIn, slideTransitionOut],
  )

  const layers = useSlideAnimation({
    content: layerContent,
    contentKey,
    isVisible,
    animationIn: toAnimationConfig(animationIn),
    animationOut: toAnimationConfig(animationOut),
    slideTransitionOut: toAnimationConfig(slideTransitionOut),
    slideTransitionIn: toAnimationConfig(slideTransitionIn),
    canMorph,
  })

  return layers.map((layer) => (
    <TextLayer
      key={layer.id}
      content={layer.content}
      animationStyle={layer.style}
      styleAnchorOffset={styleAnchorOffset}
      leaving={layer.leaving}
      morph={layer.morph}
      onMorphRejected={layer.rejectMorph}
      split={morphLines === undefined ? null : splitBy}
      lineTransitions={lineTransitions}
      typewriter={layer.typewriter}
    />
  ))
}, arePropsEqual)

// Export with the expected name
export { AnimatedTextInner as AnimatedText }
