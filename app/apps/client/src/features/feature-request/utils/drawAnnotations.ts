import { drawNoteLabels } from './drawNoteLabels'
import { drawStrokes } from './drawStrokes'
import { getScreenshotNotes } from './getScreenshotNotes'
import type { Annotation, Stroke } from '../types'

/** Paints the drawing, then the numbered notes on top of it. */
export function drawAnnotations(
  context: CanvasRenderingContext2D,
  annotations: Annotation[],
): void {
  const strokes = annotations.filter(
    (annotation): annotation is { kind: 'stroke' } & Stroke =>
      annotation.kind === 'stroke',
  )
  drawStrokes(context, strokes)
  drawNoteLabels(context, getScreenshotNotes(annotations))
}
