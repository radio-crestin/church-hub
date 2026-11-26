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
import { animateIn } from './utils/animateIn'
import { enteringOpacity } from './utils/enteringOpacity'
import { glideFrom } from './utils/glideFrom'
import { glideIntoPlace, type Shift } from './utils/glideIntoPlace'
import { type DrawnKeys, keySlideLines } from './utils/keySlideLines'
import type { SlideLine } from './utils/splitSlideLines'
import { FACTORY_TRANSITIONS } from '../../utils/factoryTransitions'

/** What the text looked like when it was last drawn. */
interface Drawn extends DrawnKeys {
  /**
   * Where each line and word sat in the layout, without any glide, by key;
   * null when it wasn't laid out.
   */
  places: Map<string, Shift | null>
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

/**
 * Kept words that the new layout moves by less than this (in em) snap
 * instead of gliding: a line re-centred by a sliver of a glyph.
 */
const MIN_GLIDE_EM = 0.05

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const placeOf = (element: HTMLElement | undefined): Shift | null =>
  element?.offsetParent ? { x: element.offsetLeft, y: element.offsetTop } : null

/**
 * Animates only what a slide change touched, down to single words: lines and
 * words kept from the previous slide keep their nodes and stay still (or
 * glide, when something before them moved them), new lines and words play the
 * enter transition, and the ones that left play the exit transition where they
 * were (`leaving`, drawn by LeavingLines). A morph needs the text to keep its
 * fitted size; otherwise the kept words would change size too, and the change
 * is handed back as a whole-slide crossfade.
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
    lineKeys: [],
    tokenKeys: [],
    places: new Map(),
    fontSize: null,
    morph,
    generation: 0,
  })
  const units = useRef(new Map<string, HTMLElement>())
  const entering = useRef(new Map<string, Animation>())
  const glides = useRef(new Map<string, Animation>())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const [leaving, setLeaving] = useState<LeavingLinesData[]>([])

  const keyed = useMemo(
    () => keySlideLines(drawn.current, lines, drawn.current.generation + 1),
    [lines],
  )
  const { lineKeys, tokenKeys, lineMatch, tokenMatch } = keyed

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const unitRef = useCallback((key: string, element: HTMLElement | null) => {
    if (element) units.current.set(key, element)
    else units.current.delete(key)
  }, [])

  const isNewMorph = morph !== null && morph !== drawn.current.morph

  const placesNow = () =>
    new Map(
      [...lineKeys, ...tokenKeys.flat()].map((key) => [
        key,
        placeOf(units.current.get(key)),
      ]),
    )

  // The page around the text can move it without a new text (a preview laid
  // out late, or shown again): keep the places current on every draw, so a
  // kept word glides from where it really was.
  useLayoutEffect(() => {
    if (!isNewMorph && drawn.current.lineKeys === lineKeys) {
      drawn.current.places = placesNow()
    }
  })

  const rejects = (fontSize: number): boolean => {
    const before = drawn.current.fontSize
    if (!isNewMorph || before === null || before === fontSize) return false
    onReject?.()
    return true
  }

  /** Draws the words that left over the new text, fading out (LeavingLines). */
  const leave = () => {
    const before = drawn.current
    const keptTokens = new Map<number, Set<number>>()
    lineMatch.forEach((match, line) => {
      if (match === null) return
      const kept = tokenMatch[line].filter((token) => token !== null)
      keptTokens.set(match, new Set(kept))
    })
    const leaves = before.tokenKeys.map((keys, line) =>
      keys.map((_, token) => !keptTokens.get(line)?.has(token)),
    )
    if (!leaves.flat().some(Boolean) || (exit.type ?? 'fade') === 'none') {
      return
    }
    const data: LeavingLinesData = {
      id: before.generation,
      lines: before.lines,
      lineKeys: before.lineKeys,
      tokenKeys: before.tokenKeys,
      leaves,
      fromOpacity: before.tokenKeys.map((keys, line) =>
        keys.map(
          (key) =>
            enteringOpacity(entering.current.get(key)) *
            enteringOpacity(entering.current.get(before.lineKeys[line])),
        ),
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

  const fadeIn = (key: string) => {
    const element = units.current.get(key)
    const animation = element ? animateIn(element, enter) : null
    if (animation) entering.current.set(key, animation)
  }

  /**
   * Where each kept word that moved starts its glide. Reads only, all before
   * any animation starts, so measuring never forces a layout mid-way.
   */
  const measureGlides = (places: Drawn['places'], fontSize: number) => {
    const starts = new Map<string, Shift>()
    if ((enter.type ?? 'fade') === 'none' || prefersReducedMotion()) {
      return starts
    }
    lines.forEach((line, index) => {
      if (lineMatch[index] === null) return
      line.tokens.forEach((token, i) => {
        const key = tokenKeys[index][i]
        const element = units.current.get(key)
        const was = drawn.current.places.get(key)
        const now = places.get(key)
        if (!token.isWord || tokenMatch[index][i] === null) return
        if (!element || !was || !now) return
        const from = glideFrom(
          element,
          glides.current.get(key),
          { x: was.x - now.x, y: was.y - now.y },
          fontSize * MIN_GLIDE_EM,
        )
        if (from) starts.set(key, from)
      })
    })
    return starts
  }

  const animate = (places: Drawn['places'], fontSize: number) => {
    const glideStarts = measureGlides(places, fontSize)
    const glideMs =
      enter.duration ?? FACTORY_TRANSITIONS.slideTransitionIn.duration
    for (const [key, from] of glideStarts) {
      const element = units.current.get(key)
      if (!element) continue
      glides.current.set(
        key,
        glideIntoPlace(element, glides.current.get(key), from, glideMs),
      )
    }
    lines.forEach((line, index) => {
      if (lineMatch[index] === null) {
        fadeIn(lineKeys[index])
        return
      }
      line.tokens.forEach((_, i) => {
        if (tokenMatch[index][i] === null) fadeIn(tokenKeys[index][i])
      })
    })
    leave()
    const present = new Set([...lineKeys, ...tokenKeys.flat()])
    for (const map of [entering.current, glides.current]) {
      for (const key of map.keys()) if (!present.has(key)) map.delete(key)
    }
  }

  const play = (fontSize: number) => {
    // Every read first (the new layout), then every animation, in one frame
    const places = placesNow()
    if (isNewMorph) animate(places, fontSize)
    drawn.current = {
      lines,
      lineKeys,
      tokenKeys,
      places,
      fontSize,
      morph,
      generation: drawn.current.generation + 1,
    }
  }

  return { lineKeys, tokenKeys, unitRef, leaving, rejects, play }
}
