import { drawNoteLabels } from './drawNoteLabels'
import { drawShape } from './drawShape'
import { drawStrokes } from './drawStrokes'
import { getScreenshotNotes } from './getScreenshotNotes'
import type { Annotation } from '../types'

/** Paints the drawings and shapes in the order made, then the notes on top. */
export function drawAnnotations(
  context: CanvasRenderingContext2D,
  annotations: Annotation[],
): void {
  for (const annotation of annotations) {
    if (annotation.kind === 'stroke') drawStrokes(context, [annotation])
    if (annotation.kind === 'shape') drawShape(context, annotation)
  }
  drawNoteLabels(context, getScreenshotNotes(annotations))
}
