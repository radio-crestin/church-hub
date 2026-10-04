import { type RefObject, useEffect, useRef } from 'react'

import type { Stroke, StrokePoint } from '../types'
import { drawStrokes } from '../utils/drawStrokes'

// Pen width in CSS pixels; scaled so it looks the same at any canvas size.
const PEN_WIDTH = 4

/**
 * Pen drawing on a canvas that shows the screenshot. Strokes are kept in
 * canvas pixels so they line up with the full-size screenshot at export,
 * however small the canvas is shown (phones).
 */
export function usePenDrawing(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  screenshot: HTMLCanvasElement,
  strokes: Stroke[],
  onStrokesChange: (strokes: Stroke[]) => void,
  color: string,
) {
  const activeStroke = useRef<Stroke | null>(null)

  const redraw = (extra: Stroke | null = null) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.drawImage(screenshot, 0, 0)
    drawStrokes(context, extra ? [...strokes, extra] : strokes)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = screenshot.width
    canvas.height = screenshot.height
    redraw()
  }, [screenshot, strokes])

  const toCanvasPoint = (event: React.PointerEvent): StrokePoint => {
    const canvas = event.currentTarget as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    activeStroke.current = {
      color,
      width: (PEN_WIDTH * event.currentTarget.width) / rect.width,
      points: [toCanvasPoint(event)],
    }
    redraw(activeStroke.current)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStroke.current) return
    activeStroke.current.points.push(toCanvasPoint(event))
    redraw(activeStroke.current)
  }

  const onPointerUp = () => {
    if (!activeStroke.current) return
    onStrokesChange([...strokes, activeStroke.current])
    activeStroke.current = null
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }
}
