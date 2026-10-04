import { drawStrokes } from './drawStrokes'
import type { Stroke } from '../types'

const JPEG_QUALITY = 0.85

/** Flattens the screenshot and the user's drawing into one JPEG data URL. */
export function renderAnnotatedScreenshot(
  screenshot: HTMLCanvasElement,
  strokes: Stroke[],
): string {
  const output = document.createElement('canvas')
  output.width = screenshot.width
  output.height = screenshot.height
  const context = output.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is not available')
  context.drawImage(screenshot, 0, 0)
  drawStrokes(context, strokes)
  return output.toDataURL('image/jpeg', JPEG_QUALITY)
}
