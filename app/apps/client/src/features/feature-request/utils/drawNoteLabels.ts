import { isLightColor } from './isLightColor'
import { wrapText } from './wrapText'
import type { ScreenshotNote } from '../types'

const TEXT_COLOR = '#111827'
// A white or yellow note gets a dark outline so its white box still shows.
const LIGHT_NOTE_OUTLINE = '#111827'

/** Font size in canvas pixels: readable at any screenshot width. */
export function getNoteFontSize(canvasWidth: number): number {
  return Math.max(14, Math.round(canvasWidth / 70))
}

/**
 * Paints each note as a numbered badge in its colour at its spot, with its
 * text in a white box beside it. The numbers match the list sent as text in the issue.
 */
export function drawNoteLabels(
  context: CanvasRenderingContext2D,
  notes: ScreenshotNote[],
): void {
  const { width, height } = context.canvas
  const fontSize = getNoteFontSize(width)
  const radius = fontSize * 0.8
  const padding = fontSize * 0.4
  const lineHeight = fontSize * 1.25
  const maxTextWidth = Math.min(width * 0.3, fontSize * 18)

  context.save()
  context.font = `600 ${fontSize}px system-ui, sans-serif`
  context.textBaseline = 'middle'
  notes.forEach((note, index) => {
    const lines = wrapText(context, note.text, maxTextWidth)
    const boxWidth =
      Math.max(...lines.map((line) => context.measureText(line).width)) +
      padding * 2
    const boxHeight = lines.length * lineHeight + padding * 2
    const fitsRight = note.x + radius + 4 + boxWidth <= width
    const boxX = fitsRight
      ? note.x + radius + 4
      : Math.max(0, note.x - radius - 4 - boxWidth)
    const boxY = Math.min(
      Math.max(0, note.y - boxHeight / 2),
      Math.max(0, height - boxHeight),
    )

    context.fillStyle = '#ffffff'
    const isLight = isLightColor(note.color)
    context.strokeStyle = isLight ? LIGHT_NOTE_OUTLINE : note.color
    context.lineWidth = Math.max(2, fontSize / 8)
    context.beginPath()
    context.roundRect(boxX, boxY, boxWidth, boxHeight, padding)
    context.fill()
    context.stroke()
    context.fillStyle = TEXT_COLOR
    context.textAlign = 'left'
    lines.forEach((line, lineIndex) => {
      context.fillText(
        line,
        boxX + padding,
        boxY + padding + lineHeight * (lineIndex + 0.5),
      )
    })

    context.fillStyle = note.color
    context.beginPath()
    context.arc(note.x, note.y, radius, 0, Math.PI * 2)
    context.fill()
    if (isLight) context.stroke()
    context.fillStyle = isLight ? TEXT_COLOR : '#ffffff'
    context.textAlign = 'center'
    context.fillText(String(index + 1), note.x, note.y)
  })
  context.restore()
}
