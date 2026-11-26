import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { LeavingLinesData } from './LeavingLines'
import type { SlideAnimationConfig } from './useSlideAnimation'
import { animateLineIn } from './utils/animateLineIn'
import { enteringOpacity } from './utils/enteringOpacity'
import { glideLine } from './utils/glideLine'
import { keySlideLines } from './utils/keySlideLines'
import type { SlideLine } from './utils/splitSlideLines'
import { FACTORY_TRANSITIONS } from '../../utils/factoryTransitions'

/** What the text looked like when it was last drawn. */
interface Drawn {
  lines: SlideLine[]
  keys: string[]
  /** Each line's top in the layout, without any glide; null when not laid out */
  tops: (number | null)[]
  fontSize: number | null
  morph: number | null
  generation: number
}

interface UseLineMorphOptions {
  lines: SlideLine[]
  /** SlideLayer.morph: a new number when a slide change morphs this text */
  morph: number | null
  enter: SlideAnimationConfig
  exit: SlideAnimationConfig
  /** SlideLayer.rejectMorph */
  onReject?: () => void
}

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Animates only the lines a slide change touched: lines shared with the
 * previous slide keep their nodes and stay still (or glide, if lines added or
 * taken away above them move them), new lines play the enter transition, and
 * the lines that left play the exit transition where they were (`leaving`,
 * drawn by LeavingLines). A morph needs the text to keep its fitted size;
 * otherwise the shared lines would change size too, and the change is handed
 * back as a whole-slide crossfade.
 *
 * The text calls `rejects` with its new fitted size before applying it, and
 * `play` once applied, from the same layout effect, before the browser paints.
 */
export function useLineMorph({
  lines,
  morph,
  enter,
  exit,
  onReject,
}: UseLineMorphOptions) {
  const drawn = useRef<Drawn>({
    lines: [],
    keys: [],
    tops: [],
    fontSize: null,
    morph,
    generation: 0,
  })
  const lineEls = useRef(new Map<string, HTMLDivElement>())
  const entering = useRef(new Map<string, Animation>())
  const glides = useRef(new Map<string, Animation>())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const [leaving, setLeaving] = useState<LeavingLinesData[]>([])

  const { keys, matchOf } = useMemo(
    () =>
      keySlideLines(
        drawn.current.lines.map((line) => line.text),
        drawn.current.keys,
        lines.map((line) => line.text),
        drawn.current.generation + 1,
      ),
    [lines],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const lineRef = useCallback((key: string, line: HTMLDivElement | null) => {
    if (line) lineEls.current.set(key, line)
    else lineEls.current.delete(key)
  }, [])

  const isNewMorph = morph !== null && morph !== drawn.current.morph

  const topsOf = (lineKeys: string[]) =>
    lineKeys.map((key) => {
      const line = lineEls.current.get(key)
      return line?.offsetParent ? line.offsetTop : null
    })

  // The page around the text can move it without a new text (a preview laid
  // out late, or shown again): keep the tops current on every draw, so a
  // shared line glides from where it really was.
  useLayoutEffect(() => {
    if (!isNewMorph && drawn.current.keys === keys) {
      drawn.current.tops = topsOf(keys)
    }
  })

  const rejects = (fontSize: number): boolean => {
    const before = drawn.current.fontSize
    if (!isNewMorph || before === null || before === fontSize) return false
    onReject?.()
    return true
  }

  const leave = (fromKeys: Set<string>) => {
    const before = drawn.current
    const leaves = before.keys.map((key) => !fromKeys.has(key))
    if (!leaves.some(Boolean) || (exit.type ?? 'fade') === 'none') return
    const data: LeavingLinesData = {
      id: before.generation,
      lines: before.lines,
      keys: before.keys,
      leaves,
      fromOpacity: before.keys.map((key) =>
        enteringOpacity(entering.current.get(key)),
      ),
      fontSize: before.fontSize ?? 0,
    }
    setLeaving((current) => [...current, data])
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setLeaving((current) => current.filter((item) => item !== data))
    }, exit.duration ?? FACTORY_TRANSITIONS.slideTransitionOut.duration)
    timers.current.add(timer)
  }

  const animate = () => {
    const before = drawn.current
    const glideMs =
      (enter.type ?? 'fade') === 'none' || prefersReducedMotion()
        ? 0
        : (enter.duration ?? FACTORY_TRANSITIONS.slideTransitionIn.duration)
    keys.forEach((key, index) => {
      const line = lineEls.current.get(key)
      const match = matchOf[index]
      if (!line) return
      if (match === null) {
        const animation = animateLineIn(line, enter)
        if (animation) entering.current.set(key, animation)
      } else if (
        glideMs > 0 &&
        before.tops[match] != null &&
        line.offsetParent
      ) {
        const glide = glideLine(
          line,
          glides.current.get(key),
          (before.tops[match] ?? 0) - line.offsetTop,
          glideMs,
        )
        if (glide) glides.current.set(key, glide)
      }
    })
    const kept = new Set(keys)
    leave(kept)
    for (const map of [entering.current, glides.current]) {
      for (const key of map.keys()) if (!kept.has(key)) map.delete(key)
    }
  }

  const play = (fontSize: number) => {
    if (isNewMorph) animate()
    drawn.current = {
      lines,
      keys,
      tops: topsOf(keys),
      fontSize,
      morph,
      generation: drawn.current.generation + 1,
    }
  }

  return { keys, lineRef, leaving, rejects, play }
}
