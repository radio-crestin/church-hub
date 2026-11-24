import type { CopiedPosition } from './CopiedPosition'
import type { Constraint, Constraints, SizeWithUnits } from '../../../types'

/**
 * A copied position as it lands on a screen of `width`×`height`: percentages
 * stay as they are, pixels scale with the screen, so the element keeps its
 * place on a screen of another resolution.
 */
export function fitPositionToScreen(
  copied: CopiedPosition,
  width: number,
  height: number,
): { constraints: Constraints; size: SizeWithUnits } {
  const sx = width / copied.screenWidth
  const sy = height / copied.screenHeight
  const scale = (edge: Constraint, ratio: number): Constraint =>
    edge.unit === 'px' ? { ...edge, value: edge.value * ratio } : { ...edge }
  const { constraints: c, size } = copied
  return {
    constraints: {
      top: scale(c.top, sy),
      right: scale(c.right, sx),
      bottom: scale(c.bottom, sy),
      left: scale(c.left, sx),
    },
    size: {
      ...size,
      width: size.widthUnit === 'px' ? size.width * sx : size.width,
      height: size.heightUnit === 'px' ? size.height * sy : size.height,
    },
  }
}
