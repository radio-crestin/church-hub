import { diffSlideLines } from '../../../utils/diffSlideLines'
import type { TextLayerContent } from '../TextLayer'

/**
 * Whether a text can change in place, animating only its changed lines: it
 * keeps its box, style and scale, and shares at least one line as drawn
 * (after line compression, which can join every line into one). The fitted
 * size is checked once the new text is laid out (useLineMorph).
 */
export function canMorphText(
  from: TextLayerContent,
  to: TextLayerContent,
): boolean {
  return (
    from.width === to.width &&
    from.height === to.height &&
    from.left === to.left &&
    from.top === to.top &&
    from.contentScale === to.contentScale &&
    JSON.stringify(from.style) === JSON.stringify(to.style) &&
    diffSlideLines(from.text.split('\n'), to.text.split('\n')).shared > 0
  )
}
