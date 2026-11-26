import { type DeckFrame, deckFrame } from './deckFrame'
import type { DeckAnimation, DeckDirection, DeckTargetState } from '../types'

/** Where a part sits on its slide, for the effects that come from off it. */
export interface DeckBox {
  x: number
  y: number
  w: number
  h: number
  deckWidth: number
  deckHeight: number
}

/** Rise Up comes from this far below. */
const RISE_PX = 100

/** Off the slide on the side it comes from (Fly In). */
function offSlide(direction: DeckDirection, box: DeckBox) {
  switch (direction) {
    case 'left':
      return { dx: -(box.x + box.w), dy: 0 }
    case 'right':
      return { dx: box.deckWidth - box.x, dy: 0 }
    case 'up':
      return { dx: 0, dy: -(box.y + box.h) }
    case 'down':
      return { dx: 0, dy: box.deckHeight - box.y }
  }
}

/** Fully cut away from the side it is wiped in from. */
function wipedFrom(direction: DeckDirection): DeckFrame['clip'] {
  switch (direction) {
    case 'left':
      return [0, 100, 0, 0]
    case 'right':
      return [0, 0, 0, 100]
    case 'up':
      return [0, 0, 100, 0]
    case 'down':
      return [100, 0, 0, 0]
  }
}

/** Shown, but posed as an entrance's effect starts from. */
function hiddenPose(
  animation: DeckAnimation,
  shown: DeckFrame,
  box: DeckBox,
): DeckFrame {
  const direction = animation.direction
  switch (animation.effect) {
    case 'appear':
      return { ...shown, visible: false }
    case 'fly':
      return { ...shown, ...offSlide(direction ?? 'down', box) }
    case 'wipe':
      return { ...shown, clip: wipedFrom(direction ?? 'down') }
    case 'split':
      return {
        ...shown,
        clip:
          direction === 'up' || direction === 'down'
            ? [50, 0, 50, 0]
            : [0, 50, 0, 50],
      }
    case 'zoom':
      return { ...shown, scale: 0, opacity: 0 }
    case 'rise_up':
      return { ...shown, dy: RISE_PX, opacity: 0 }
    case 'grow_turn':
      return { ...shown, scale: 0, rotate: -90, opacity: 0 }
    default:
      return { ...shown, opacity: 0 }
  }
}

/**
 * An emphasis's poses from `before`: Appear holds it as it stands (an
 * imported motion path or click-started video keeps its click); an effect
 * that is no emphasis pulses.
 */
function emphasisFrames(animation: DeckAnimation, before: DeckFrame) {
  switch (animation.effect) {
    case 'appear':
      return [before, before]
    case 'grow_shrink':
      return [before, { ...before, scale: before.scale * 1.5 }]
    case 'spin':
      return [before, { ...before, rotate: 360 }]
    case 'transparency':
      return [before, { ...before, opacity: 0.5 }]
    default:
      return [before, { ...before, scale: before.scale * 1.1 }, before]
  }
}

/**
 * The poses one effect moves a part through, evenly spaced over its time:
 * an entrance from its hidden pose to the part as it rests, an exit the other
 * way (hidden at its end), an emphasis from how it stood.
 */
export function effectFrames(
  animation: DeckAnimation,
  before: DeckTargetState,
  after: DeckTargetState,
  box: DeckBox,
): DeckFrame[] {
  if (animation.kind === 'emphasis') {
    return emphasisFrames(animation, deckFrame(before))
  }
  if (animation.kind === 'entrance') {
    const shown = deckFrame(after)
    return [hiddenPose(animation, shown, box), shown]
  }
  const shown = deckFrame({ ...before, visible: true })
  const gone = hiddenPose(animation, shown, box)
  return [shown, { ...gone, visible: false }]
}
