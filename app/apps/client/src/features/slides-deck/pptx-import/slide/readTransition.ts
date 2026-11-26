import type { PptxShapeNote } from './types'
import type {
  DeckDirection,
  DeckTransition,
  DeckTransitionEffect,
} from '../../types'
import { xmlChild } from '../xml/xmlChild'
import { xmlChildren } from '../xml/xmlChildren'
import { xmlNumber } from '../xml/xmlNumber'

const SPEED_MS: Record<string, number> = { slow: 1000, med: 750, fast: 500 }

const EFFECTS: Record<string, DeckTransitionEffect> = {
  fade: 'fade',
  push: 'push',
  wipe: 'wipe',
  cover: 'cover',
  pull: 'cover',
  split: 'split',
  zoom: 'zoom',
  cut: 'none',
}

/**
 * Where the new slide comes from, as LibreOffice reads PowerPoint's `dir`
 * (oox/source/ppt/slidetransition.cxx): Push, Cover and Uncover name the
 * side it comes from (`u` from the bottom, `d` from the top); Wipe names the
 * way it sweeps; Split is vertical or horizontal.
 */
function directionOf(effect: Element): DeckDirection | undefined {
  const dir = effect.getAttribute('dir')
  switch (effect.localName) {
    case 'push':
    case 'cover':
    case 'pull':
      return ({ l: 'left', r: 'right', u: 'down', d: 'up' } as const)[
        dir ?? 'l'
      ]
    case 'wipe':
      return ({ l: 'right', r: 'left', u: 'down', d: 'up' } as const)[
        dir ?? 'l'
      ]
    case 'split':
      return effect.getAttribute('orient') === 'vert' ? 'left' : 'up'
    default:
      return undefined
  }
}

/** The `p:transition` that applies: the first `mc:Choice`'s, else the fallback's. */
function findTransition(slide: Document): Element | null {
  const root = slide.documentElement
  const own = xmlChild(root, 'transition')
  if (own) return own
  for (const alternate of xmlChildren(root, 'AlternateContent')) {
    for (const branch of [
      ...xmlChildren(alternate, 'Choice'),
      ...xmlChildren(alternate, 'Fallback'),
    ]) {
      const found = xmlChild(branch, 'transition')
      if (found) return found
    }
  }
  return null
}

/**
 * A slide's transition (`p:transition`, in or out of `mc:AlternateContent`):
 * its effect, direction and length (`p14:dur`, else `spd`), and how long the
 * slide stays before moving on by itself (`advTm`). Effects the deck has not
 * (Vortex, Ripple, Morph…) play as a fade.
 */
export function readTransition(slide: Document): {
  transition?: DeckTransition
  advanceAfterMs?: number
  note?: PptxShapeNote
} {
  const transition = findTransition(slide)
  if (!transition) return {}
  const advance = xmlNumber(transition, 'advTm')
  const advanceAfterMs =
    advance === undefined ? undefined : Math.min(3_600_000, advance)
  const effect = xmlChildren(transition).find(
    (child) => child.localName !== 'sndAc' && child.localName !== 'extLst',
  )
  if (!effect) return { advanceAfterMs }
  const durationMs = Math.min(
    60_000,
    xmlNumber(transition, 'p14:dur') ??
      SPEED_MS[transition.getAttribute('spd') ?? 'fast'] ??
      500,
  )
  const mapped = EFFECTS[effect.localName]
  return {
    transition: {
      effect: mapped ?? 'fade',
      direction: mapped ? directionOf(effect) : undefined,
      durationMs,
    },
    advanceAfterMs,
    note: mapped
      ? undefined
      : { outcome: 'changed', reason: 'transition', detail: effect.localName },
  }
}
