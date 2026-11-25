import type { DeckFrame } from './deckFrame'
import { deckTransform } from './deckTransform'

/** A pose as a Web Animations keyframe at `offset`. */
export function toKeyframe(
  frame: DeckFrame,
  offset: number,
  easing?: string,
): Keyframe {
  const [t, r, b, l] = frame.clip
  return {
    offset,
    visibility: frame.visible ? 'visible' : 'hidden',
    opacity: frame.opacity,
    transform: deckTransform(frame.dx, frame.dy, frame.scale, frame.rotate),
    clipPath: `inset(${t}% ${r}% ${b}% ${l}%)`,
    ...(easing ? { easing } : {}),
  }
}
