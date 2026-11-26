import type { DeckTargetState } from '../types'

/**
 * One pose of an animated part, with every property any effect moves, so the
 * frames of one part always interpolate property for property.
 */
export interface DeckFrame {
  visible: boolean
  opacity: number
  scale: number
  /** Design pixels. */
  dx: number
  dy: number
  rotate: number
  /** Percent cut from the top, right, bottom and left. */
  clip: [number, number, number, number]
}

/** The pose a part rests in, as its state leaves it. */
export function deckFrame(state: DeckTargetState): DeckFrame {
  return {
    visible: state.visible,
    opacity: state.opacity,
    scale: state.scale,
    dx: 0,
    dy: 0,
    rotate: 0,
    clip: [0, 0, 0, 0],
  }
}
