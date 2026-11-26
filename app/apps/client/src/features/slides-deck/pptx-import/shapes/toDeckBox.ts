import type { PptxBox } from './types'
import type { DeckElementBase } from '../../types'

const round = (value: number) => Math.round(value * 100) / 100

/** A box in design pixels, its rotation kept from -180 to 180 degrees. */
export function toDeckBox(
  box: PptxBox,
  scale: number,
): Pick<DeckElementBase, 'x' | 'y' | 'w' | 'h' | 'rotation'> {
  const turned = ((((box.rotation + 180) % 360) + 360) % 360) - 180
  return {
    x: round(box.x * scale),
    y: round(box.y * scale),
    w: round(Math.max(0, box.w * scale)),
    h: round(Math.max(0, box.h * scale)),
    rotation: Math.abs(turned) < 0.01 ? undefined : round(turned),
  }
}
