import type { Shape } from '../types'

/** Paints one rectangle, ellipse or arrow (in canvas pixels). */
export function drawShape(context: CanvasRenderingContext2D, shape: Shape) {
  const { from, to } = shape
  context.save()
  context.strokeStyle = shape.color
  context.fillStyle = shape.color
  context.lineWidth = shape.width
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  if (shape.shape === 'rect') {
    context.rect(from.x, from.y, to.x - from.x, to.y - from.y)
    context.stroke()
  } else if (shape.shape === 'ellipse') {
    context.ellipse(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2,
      Math.abs(to.x - from.x) / 2,
      Math.abs(to.y - from.y) / 2,
      0,
      0,
      Math.PI * 2,
    )
    context.stroke()
  } else {
    drawArrow(context, shape)
  }
  context.restore()
}

/** A line from the tail to the tip, with a filled head at the tip. */
function drawArrow(context: CanvasRenderingContext2D, shape: Shape) {
  const { from, to, width } = shape
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const headLength = width * 4.5
  const headAngle = Math.PI / 7
  // Stop the line inside the head so its round cap does not poke out.
  const lineEnd = {
    x: to.x - Math.cos(angle) * headLength * 0.6,
    y: to.y - Math.sin(angle) * headLength * 0.6,
  }
  context.moveTo(from.x, from.y)
  context.lineTo(lineEnd.x, lineEnd.y)
  context.stroke()
  context.beginPath()
  context.moveTo(to.x, to.y)
  context.lineTo(
    to.x - headLength * Math.cos(angle - headAngle),
    to.y - headLength * Math.sin(angle - headAngle),
  )
  context.lineTo(
    to.x - headLength * Math.cos(angle + headAngle),
    to.y - headLength * Math.sin(angle + headAngle),
  )
  context.closePath()
  context.fill()
}
