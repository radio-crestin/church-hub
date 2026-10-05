import { type RefObject, useEffect, useRef } from 'react'

import type { Annotation, AnnotationTool, Stroke, StrokePoint } from '../types'
import { drawAnnotations } from '../utils/drawAnnotations'
import { NOTE_COLOR } from '../utils/drawNoteLabels'

// Pen width in CSS pixels; scaled so it looks the same at any canvas size.
const PEN_WIDTH = 4

/** Where a new note goes: canvas pixels, and CSS pixels inside the canvas box. */
export interface NoteSpot {
  canvas: StrokePoint
  css: StrokePoint
}

/**
 * The screenshot canvas with the user's drawing and notes on it. With the
 * pen, dragging draws; with the note tool, a click reports the spot so the
 * caller can ask for the note's text. Points are kept in canvas pixels so
 * they line up with the full-size screenshot at export, however small the
 * canvas is shown (phones).
 */
export function useAnnotationCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  screenshot: HTMLCanvasElement,
  annotations: Annotation[],
  onAnnotationsChange: (annotations: Annotation[]) => void,
  tool: AnnotationTool,
  onPlaceNote: (spot: NoteSpot) => void,
) {
  const activeStroke = useRef<Stroke | null>(null)

  const redraw = (extra: Stroke | null = null) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.drawImage(screenshot, 0, 0)
    drawAnnotations(
      context,
      extra ? [...annotations, { kind: 'stroke', ...extra }] : annotations,
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
    const rect = event.currentTarget.getBoundingClientRect()
    if (tool === 'note') {
      // No mousedown follows, so focus stays in the note box that opens.
      event.preventDefault()
      onPlaceNote({
        canvas: toCanvasPoint(event),
        css: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      })
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    activeStroke.current = {
      color: NOTE_COLOR,
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
    onAnnotationsChange([
      ...annotations,
      { kind: 'stroke', ...activeStroke.current },
    ])
    activeStroke.current = null
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }
}
