import { type DeckBox, effectFrames } from './effectFrames'
import { findDeckTarget } from './findDeckTarget'
import { type DeckSegment, targetTimeline } from './targetTimeline'
import type { DeckClickGroup, DeckSlide } from '../types'
import { deckTargetKey } from '../utils/deckTargetKey'
import { deckTargetStates, RESTING_STATE } from '../utils/deckTargetStates'
import { stateAfterAnimation } from '../utils/stateAfterAnimation'

const EASING = {
  entrance: 'ease-out',
  exit: 'ease-in',
  emphasis: 'ease-in-out',
}

interface PlayClickGroupInput {
  /** The drawn slide: its parts carry `data-deck-target` / `data-deck-text`. */
  root: HTMLElement
  slide: DeckSlide
  groups: DeckClickGroup[]
  buildIndex: number
  /** The deck's design size. */
  width: number
  height: number
  /** Waits this long first (the slide's transition). */
  offsetMs: number
}

/**
 * Plays click group `buildIndex` of a drawn slide with the Web Animations
 * API, each part's effects chained into one animation (targetTimeline). The
 * parts are already drawn as the group leaves them; each animation fills
 * backwards, so until its effect starts a part keeps how the builds before
 * left it.
 */
export function playClickGroup({
  root,
  slide,
  groups,
  buildIndex,
  width,
  height,
  offsetMs,
}: PlayClickGroupInput): Animation[] {
  const states = deckTargetStates(groups, buildIndex - 1)
  const segments = new Map<
    string,
    { node: HTMLElement; segments: DeckSegment[] }
  >()
  for (const { elementId, animation, startMs } of groups[buildIndex] ?? []) {
    const key = deckTargetKey(elementId, animation.paragraphIndex)
    const element = slide.elements.find((e) => e.id === elementId)
    const node = findDeckTarget(root, elementId, animation.paragraphIndex)
    if (!element || !node) continue
    const before = states.get(key) ?? RESTING_STATE
    const after = stateAfterAnimation(before, animation)
    states.set(key, after)
    const box: DeckBox = {
      x: element.x,
      y: element.y,
      w: element.w,
      h: element.h,
      deckWidth: width,
      deckHeight: height,
    }
    const entry = segments.get(key) ?? { node, segments: [] }
    entry.segments.push({
      startMs,
      durationMs: animation.durationMs,
      frames: effectFrames(animation, before, after, box),
      easing: EASING[animation.kind],
    })
    segments.set(key, entry)
  }
  return [...segments.values()].map(({ node, segments: list }) => {
    const { delayMs, durationMs, keyframes } = targetTimeline(list)
    return node.animate(keyframes, {
      delay: offsetMs + delayMs,
      duration: durationMs,
      fill: 'backwards',
    })
  })
}
