import { mapPreset, type PptxMappedEffect } from './mapPreset'
import type { PptxTiming } from './types'
import type { DeckAnimation, DeckElement } from '../../types'
import type { PptxShapeNote } from '../slide/types'

/** Ten minutes: the longest delay or effect a deck keeps. */
const MAX_MS = 600_000

/** Holds a shape as it is: keeps a click the deck cannot play (a motion path, a video started on a click). */
const HOLD: PptxMappedEffect = {
  kind: 'emphasis',
  effect: 'appear',
  exact: true,
}

/**
 * A slide's elements with the animations of its timing tree, in PowerPoint's
 * play order (`animationOrder`), so its clicks are PowerPoint's clicks: an
 * effect on a shape plays on every element it became (its text box and
 * outline together; a paragraph build on the text only, a background build
 * on the outline only). A video started by the timing plays as the slide
 * comes in (`autoplay`), with its volume and mute; one started on a click
 * plays from the start too, its click kept. An effect on a shape that did
 * not come in hands its click to the next one in its group.
 */
export function applyTiming(
  elements: DeckElement[],
  targets: Map<string, string[]>,
  timing: PptxTiming,
): {
  elements: DeckElement[]
  animationOrder?: string[]
  notes: PptxShapeNote[]
} {
  const byId = new Map(elements.map((e) => [e.id, e]))
  const animations = new Map<string, DeckAnimation[]>()
  const order: string[] = []
  const notes: PptxShapeNote[] = []
  const playing = new Set<string>()
  let fallbacks = 0
  let paths = 0
  let group = -1
  let handedClick = false

  for (const effect of timing.effects) {
    if (effect.clickGroup !== group) {
      group = effect.clickGroup
      handedClick = false
    }
    let trigger = effect.trigger
    if (handedClick) {
      trigger = 'click'
      handedClick = false
    }
    const all = (targets.get(effect.spid) ?? []).filter((id) => byId.has(id))
    const ids =
      effect.paragraphIndex !== undefined
        ? all.filter((id) => byId.get(id)?.type === 'text').slice(0, 1)
        : effect.background
          ? all.filter((id) => byId.get(id)?.type !== 'text')
          : all
    let mapped: PptxMappedEffect | null
    if (effect.presetClass === 'mediacall') {
      const plays = effect.command?.startsWith('playFrom') ?? false
      if (plays) for (const id of ids) playing.add(id)
      if (plays && effect.clickGroup > 0) {
        notes.push({ outcome: 'changed', reason: 'playOnClick' })
      }
      mapped = trigger === 'click' && effect.clickGroup > 0 ? HOLD : null
    } else {
      mapped = mapPreset(
        effect.presetClass,
        effect.presetId,
        effect.presetSubtype,
      )
      if (effect.presetClass === 'path') paths += 1
      else if (!mapped.exact) fallbacks += 1
    }
    if (!mapped || !ids.length) {
      if (trigger === 'click') handedClick = true
      continue
    }
    ids.forEach((elementId, index) => {
      const animation: DeckAnimation = {
        id: `a${order.length + 1}`,
        kind: mapped.kind,
        effect: mapped.effect,
        direction: mapped.direction,
        trigger: index === 0 ? trigger : 'with_previous',
        delayMs: Math.min(MAX_MS, effect.delayMs),
        durationMs: Math.min(MAX_MS, effect.durationMs),
        paragraphIndex: effect.paragraphIndex,
      }
      animations.set(elementId, [
        ...(animations.get(elementId) ?? []),
        animation,
      ])
      order.push(animation.id)
    })
  }

  if (fallbacks)
    notes.push({ outcome: 'changed', reason: 'animation', count: fallbacks })
  if (paths)
    notes.push({ outcome: 'changed', reason: 'motionPath', count: paths })
  if (timing.interactive) {
    notes.push({
      outcome: 'skipped',
      reason: 'interactive',
      count: timing.interactive,
    })
  }

  // Each element's own shape: the first listed (a group comes after its shapes).
  const spidOf = new Map<string, string>()
  for (const [spid, ids] of targets) {
    for (const id of ids) if (!spidOf.has(id)) spidOf.set(id, spid)
  }
  return {
    elements: elements.map((element): DeckElement => {
      const withAnimations = animations.has(element.id)
        ? { ...element, animations: animations.get(element.id) }
        : element
      if (withAnimations.type !== 'video') return withAnimations
      const media = timing.media.get(spidOf.get(element.id) ?? '')
      return {
        ...withAnimations,
        autoplay: playing.has(element.id),
        volume: media?.volume,
        muted: media?.muted,
      }
    }),
    animationOrder: order.length ? order : undefined,
    notes,
  }
}
