import { useLayoutEffect, useMemo, useRef } from 'react'

import { LeavingLines } from './LeavingLines'
import { SlideLines } from './SlideLines'
import { useLineMorph } from './useLineMorph'
import type { SlideAnimationConfig } from './useSlideAnimation'
import { useTypewriter } from './useTypewriter'
import { calculateFontSize } from './utils/calculateFontSize'
import { fitFontSizeToBounds } from './utils/fitFontSizeToBounds'
import { getTextStyles } from './utils/getTextStyles'
import type { LayerTypewriter } from './utils/layerTypewriter'
import { splitSlideLines } from './utils/splitSlideLines'
import { useFontsLoadedVersion } from '../../hooks/useFontsLoadedVersion'
import type { TextStyle, TextStyleRange } from '../../types'
import { applyStylesToText } from '../../utils/applyStylesToText'
import type { TokenMode } from '../../utils/tokenizeLine'

/** One slide's text and everything that decides how it looks. */
export interface TextLayerContent {
  text: string
  style: TextStyle
  width: number
  height: number
  left: number
  top: number
  contentScale: number
  styleRanges?: TextStyleRange[]
}

interface TextLayerProps {
  content: TextLayerContent
  /** The layer's animation styles */
  animationStyle: React.CSSProperties
  /** See AnimatedText */
  styleAnchorOffset?: number
  /** A slide fading out under the new one: hidden from assistive tech */
  leaving?: boolean
  /** SlideLayer.morph: animate only the lines this slide change touched */
  morph?: number | null
  /** SlideLayer.rejectMorph */
  onMorphRejected?: () => void
  /** How to cut the text into parts, for a text whose slide changes can morph */
  split?: TokenMode | null
  /** The slide change transitions a morph plays on single lines */
  lineTransitions: { enter: SlideAnimationConfig; exit: SlideAnimationConfig }
  /** SlideLayer.typewriter: set while the text types itself in */
  typewriter?: LayerTypewriter<TextLayerContent> | null
}

/**
 * One copy of an animated text element: the text fitted to its box, with the
 * layer's animation styles. A slide change shows two of them at once, the old
 * slide leaving and the new one entering, each with its own size and box —
 * unless the change morphs the layer, animating only its changed lines.
 */
export function TextLayer({
  content,
  animationStyle,
  styleAnchorOffset,
  leaving = false,
  morph = null,
  onMorphRejected,
  split = null,
  lineTransitions,
  typewriter = null,
}: TextLayerProps) {
  const { text, style, width, height, left, top, contentScale, styleRanges } =
    content
  const textRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const lastFit = useRef<number | null>(null)
  const fontsLoadedVersion = useFontsLoadedVersion(style.fontFamily)

  const styledHtml = useMemo(() => {
    if (!styleRanges || styleRanges.length === 0) return null
    return applyStylesToText(text, styleRanges)
  }, [text, styleRanges])

  const lines = useMemo(
    () => splitSlideLines(text, styleRanges, split),
    [text, styleRanges, split],
  )
  const lineMorph = useLineMorph({
    lines,
    morph,
    enter: lineTransitions.enter,
    exit: lineTransitions.exit,
    onReject: onMorphRejected,
  })
  const reveal = useTypewriter({
    text,
    lines,
    lineMatch: lineMorph.lineMatch,
    tokenMatch: lineMorph.tokenMatch,
    morph,
    typewriter,
  })

  // Calculate font size synchronously before paint
  useLayoutEffect(() => {
    if (!measureRef.current || !textRef.current || !text) return

    const minFontSize = style.minFontSize ?? 12
    const fontSize = calculateFontSize(
      measureRef.current,
      text,
      width,
      height,
      style.maxFontSize,
      minFontSize,
      lastFit.current,
    )
    lastFit.current = fontSize

    // The fit measures plain text at the screen's own size; the slide's scale
    // and any enlarged run are applied on top of it and can push the words off
    // the top and bottom of the box, where they are cut off. Holding the scaled
    // size to what the rendered markup still fits into is what keeps the text on
    // the screen.
    const fitted = fitFontSizeToBounds(
      measureRef.current,
      text,
      styledHtml,
      fontSize * contentScale,
      width,
      height,
      minFontSize,
    )
    if (lineMorph.rejects(fitted)) return
    textRef.current.style.fontSize = `${fitted}px`
    lineMorph.play(fitted)
    // lineMorph is new each render; `morph` and `lines` say when it matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    morph,
    lines,
    text,
    styledHtml,
    width,
    height,
    style.maxFontSize,
    style.minFontSize,
    // Everything below changes how wide the text measures, so the fit has to be
    // redone when any of it does.
    style.bold,
    style.italic,
    style.fontFamily,
    style.lineHeight,
    contentScale,
    // A web font that finished loading measures differently from its fallback.
    fontsLoadedVersion,
  ])

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left,
    top,
    width,
    height,
    overflow: 'hidden',
    // The leaving slide never takes a click or a text selection.
    pointerEvents: leaving ? 'none' : undefined,
    ...animationStyle,
  }

  const textStyles: React.CSSProperties = {
    ...getTextStyles(style),
    // Already carries the slide's own scale so the very first paint — before
    // the fit runs — is never the plain screen size.
    fontSize: `${style.maxFontSize * contentScale}px`, // Refined by useLayoutEffect
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
    <div
      style={containerStyle}
      aria-hidden={leaving || undefined}
      data-leaving={leaving || undefined}
    >
      {/* Hidden measurement element */}
      <div ref={measureRef} style={measureStyle} aria-hidden="true" />
      <div
        ref={textRef}
        style={textStyles}
        data-style-anchor={styleAnchorOffset}
      >
        <SlideLines
          lines={lines}
          lineKeys={lineMorph.lineKeys}
          tokenKeys={lineMorph.tokenKeys}
          underline={style.underline}
          unitRef={lineMorph.unitRef}
          reveal={reveal}
        />
      </div>
      {lineMorph.leaving.map((data) => (
        <LeavingLines
          key={data.id}
          data={data}
          textStyle={textStyles}
          underline={style.underline}
          exit={lineTransitions.exit}
        />
      ))}
    </div>
  )
}
