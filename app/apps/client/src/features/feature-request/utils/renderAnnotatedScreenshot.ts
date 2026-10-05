import { drawAnnotations } from './drawAnnotations'
import type { Annotation } from '../types'

const JPEG_QUALITY = 0.85

/** Flattens the screenshot, the drawing and the notes into one JPEG data URL. */
export function renderAnnotatedScreenshot(
  screenshot: HTMLCanvasElement,
  annotations: Annotation[],
): string {
  const output = document.createElement('canvas')
  output.width = screenshot.width
  output.height = screenshot.height
  const context = output.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is not available')
  context.drawImage(screenshot, 0, 0)
  drawAnnotations(context, annotations)
  return output.toDataURL('image/jpeg', JPEG_QUALITY)
}
