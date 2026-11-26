import type {
  DeckAnimationEffect,
  DeckAnimationKind,
  DeckDirection,
} from '../../types'

/** An effect as the deck plays it; `exact` false when it stands in for one the deck has not. */
export interface PptxMappedEffect {
  kind: DeckAnimationKind
  effect: DeckAnimationEffect
  direction?: DeckDirection
  exact: boolean
}

/**
 * The side a Fly, Wipe… comes from, by its subtype as LibreOffice reads it
 * (oox/source/ppt/commontimenodecontext.cxx: 1 from the top, 2 right,
 * 4 bottom, 8 left; corners keep their side).
 */
function sideOf(subtype: number): DeckDirection | undefined {
  if (subtype & 8) return 'left'
  if (subtype & 2) return 'right'
  if (subtype & 1) return 'up'
  if (subtype & 4) return 'down'
  return undefined
}

/** A Split's direction: vertical ones (21, 37) open sideways, horizontal ones up and down. */
function splitOf(subtype: number): DeckDirection {
  return subtype === 21 || subtype === 37 ? 'left' : 'up'
}

function entranceOrExit(
  id: number,
  subtype: number,
): Omit<PptxMappedEffect, 'kind'> {
  switch (id) {
    case 1:
      return { effect: 'appear', exact: true }
    case 2:
      return {
        effect: 'fly',
        direction: sideOf(subtype) ?? 'down',
        exact: true,
      }
    case 10:
      return { effect: 'fade', exact: true }
    case 16:
      return { effect: 'split', direction: splitOf(subtype), exact: true }
    case 22:
      return {
        effect: 'wipe',
        direction: sideOf(subtype) ?? 'down',
        exact: true,
      }
    case 23:
    case 53:
      return { effect: 'zoom', exact: true }
    case 31:
      return { effect: 'grow_turn', exact: true }
    case 37:
    case 42:
      return { effect: 'rise_up', exact: true }
    case 47:
      return { effect: 'fly', direction: 'up', exact: true }
    default:
      return { effect: 'fade', exact: false }
  }
}

function emphasis(id: number): Omit<PptxMappedEffect, 'kind'> {
  switch (id) {
    case 6:
      return { effect: 'grow_shrink', exact: true }
    case 8:
      return { effect: 'spin', exact: true }
    case 9:
      return { effect: 'transparency', exact: true }
    case 26:
    case 35:
      return { effect: 'pulse', exact: true }
    default:
      return { effect: 'pulse', exact: false }
  }
}

/**
 * A PowerPoint effect preset (`presetClass`, `presetID`, `presetSubtype`) as
 * the deck's: entrances and exits by id (others fade), emphases (others
 * pulse), and a motion path, which the deck cannot move along, kept as an
 * emphasis that holds the shape where it is (so its click still counts).
 */
export function mapPreset(
  presetClass: string,
  id: number,
  subtype: number,
): PptxMappedEffect {
  switch (presetClass) {
    case 'entr':
      return { kind: 'entrance', ...entranceOrExit(id, subtype) }
    case 'exit':
      return { kind: 'exit', ...entranceOrExit(id, subtype) }
    case 'emph':
      return { kind: 'emphasis', ...emphasis(id) }
    default:
      return { kind: 'emphasis', effect: 'appear', exact: false }
  }
}
