import { useEffect, useRef, useState } from 'react'

import type { TextLayerContent } from './TextLayer'
import { useTypewriterEnabled } from './TypewriterContext'
import { changedSpans } from './utils/changedSpans'
import type { LayerTypewriter } from './utils/layerTypewriter'
import { msPerCharacter } from './utils/msPerCharacter'
import { revealAfter, type TypewriterReveal } from './utils/revealAfter'
import type { SlideLine } from './utils/splitSlideLines'
import { type TextSpan, typedSpans } from './utils/typedSpans'

interface UseTypewriterOptions {
  text: string
  lines: SlideLine[]
  /** useLineMorph's matches: which lines and words a morph kept */
  lineMatch: (number | null)[]
  tokenMatch: (number | null)[][]
  /** SlideLayer.morph */
  morph: number | null
  /** SlideLayer.typewriter: null shows the whole text */
  typewriter: LayerTypewriter<TextLayerContent> | null
}

/** One typing: from a layer's first draw, or from a slide change that morphed it. */
interface Run {
  key: number | 'mount'
  spans: TextSpan[]
  length: number
}

/**
 * Types a text in, left to right, at a pace that fits it into the layer's
 * longest typing time. A layer types its words from its first draw, but for
 * the lines the slide it replaced showed too; a slide change that morphs it
 * types only the words it brought in, the kept ones stay still. Returns what
 * is still hidden, or null once everything shows.
 */
export function useTypewriter({
  text,
  lines,
  lineMatch,
  tokenMatch,
  morph,
  typewriter,
}: UseTypewriterOptions): TypewriterReveal | null {
  const active = useTypewriterEnabled() && typewriter !== null
  const key = morph ?? 'mount'
  const run = useRef<Run | null>(null)
  if (run.current?.key !== key) {
    const spans =
      morph === null
        ? typedSpans(text, typewriter?.replaces?.text)
        : changedSpans(lines, lineMatch, tokenMatch)
    const length = spans.reduce((sum, [start, end]) => sum + end - start, 0)
    run.current = { key, spans, length }
  }
  const { spans, length } = run.current
  const [typed, setTyped] = useState({ key, count: 0 })
  const maxDurationMs = typewriter?.maxDurationMs ?? 0

  useEffect(() => {
    if (!active || length === 0) return
    const perCharacter = msPerCharacter(length, maxDurationMs)
    let startedAt: number | null = null
    let frame = 0
    const tick = (now: number) => {
      startedAt ??= now
      const count = Math.min(
        length,
        Math.floor((now - startedAt) / perCharacter),
      )
      setTyped({ key, count })
      if (count < length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, key, length, maxDurationMs])

  if (!active) return null
  return revealAfter(spans, typed.key === key ? typed.count : 0)
}
