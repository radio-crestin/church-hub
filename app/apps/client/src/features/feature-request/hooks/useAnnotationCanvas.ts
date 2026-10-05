import { type RefObject, useEffect, useRef } from 'react'

import type { Annotation, AnnotationTool, StrokePoint } from '../types'
import { drawAnnotations } from '../utils/drawAnnotations'

// Line widths in CSS pixels; scaled so they look the same at any canvas size.
const PEN_WIDTH = 4
const HIGHLIGHTER_WIDTH = 18
const HIGHLIGHTER_OPACITY = 0.35
const SHAPE_WIDTH = 4
// A shape smaller than this (CSS pixels) was a click, not a drag.
const MIN_SHAPE_SIZE = 4

/** Where a new note goes: canvas pixels, and CSS pixels inside the canvas box. */
export interface NoteSpot {
  canvas: StrokePoint
  css: StrokePoint
}

/**
 * The screenshot canvas with the user's markup on it. Pen and highlighter
 * draw free-hand; rectangle, ellipse and arrow are dragged out; the note
 * tool reports the clicked spot so the caller can ask for the text. Points
 * are kept in canvas pixels so they line up with the full-size screenshot
 * at export, however small the canvas is shown (phones).
 */
export function useAnnotationCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  screenshot: HTMLCanvasElement,
  annotations: Annotation[],
  onAnnotationsChange: (annotations: Annotation[]) => void,
  tool: AnnotationTool,
  color: string,
  onPlaceNote: (spot: NoteSpot) => void,
) {
  // The stroke or shape being drawn right now, not yet in `annotations`.
  const active = useRef<Annotation | null>(null)

  const redraw = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.drawImage(screenshot, 0, 0)
    drawAnnotations(
      context,
      active.current ? [...annotations, active.current] : annotations,
    )
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = screenshot.width
    canvas.height = screenshot.height
    redraw()
  }, [screenshot, annotations])

  const toCanvasPoint = (event: React.PointerEvent): StrokePoint => {
    const canvas = event.currentTarget as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    const scale = canvas.width / rect.width
    const point = toCanvasPoint(event)
    if (tool === 'note') {
      // No mousedown follows, so focus stays in the note box that opens.
      event.preventDefault()
      onPlaceNote({
        canvas: point,
        css: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      })
      return
    }
    canvas.setPointerCapture(event.pointerId)
    if (tool === 'pen' || tool === 'highlighter') {
      const isPen = tool === 'pen'
      active.current = {
        kind: 'stroke',
        color,
        width: (isPen ? PEN_WIDTH : HIGHLIGHTER_WIDTH) * scale,
        opacity: isPen ? 1 : HIGHLIGHTER_OPACITY,
        points: [point],
      }
    } else {
      active.current = {
        kind: 'shape',
        shape: tool,
        color,
        width: SHAPE_WIDTH * scale,
        from: point,
        to: point,
      }
    }
    redraw()
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = active.current
    if (!current) return
    const point = toCanvasPoint(event)
    if (current.kind === 'stroke') current.points.push(point)
    if (current.kind === 'shape') current.to = point
    redraw()
  }

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = active.current
    if (!current) return
    active.current = null
    if (current.kind === 'shape' && isTooSmall(current, event.currentTarget)) {
      redraw()
      return
    }
    onAnnotationsChange([...annotations, current])
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }
}

function isTooSmall(
  shape: { from: StrokePoint; to: StrokePoint },
  canvas: HTMLCanvasElement,
): boolean {
  const scale = canvas.width / canvas.getBoundingClientRect().width
  const size = Math.max(
    Math.abs(shape.to.x - shape.from.x),
    Math.abs(shape.to.y - shape.from.y),
  )
  return size < MIN_SHAPE_SIZE * scale
}
