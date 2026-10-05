import type { Stroke } from '../types'

/** Paints free-hand strokes (in canvas pixels) on top of the canvas. */
export function drawStrokes(
  context: CanvasRenderingContext2D,
  strokes: Stroke[],
): void {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const stroke of strokes) {
    const [first, ...rest] = stroke.points
    if (!first) continue
    context.globalAlpha = stroke.opacity
    context.strokeStyle = stroke.color
    context.lineWidth = stroke.width
    context.beginPath()
    context.moveTo(first.x, first.y)
    // A single tap still leaves a dot.
    for (const point of rest.length > 0 ? rest : [first]) {
      context.lineTo(point.x, point.y)
    }
    context.stroke()
  }
  context.restore()
}
