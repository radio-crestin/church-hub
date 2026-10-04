export const HIGHLIGHT_COLOR = '#ef4444'
const HIGHLIGHT_PADDING = 4
const HIGHLIGHT_LINE_WIDTH = 3

/** Outlines the picked element on the screenshot so it stands out in the issue. */
export function drawElementHighlight(
  canvas: HTMLCanvasElement,
  rect: DOMRect,
  scale: number,
): void {
  const context = canvas.getContext('2d')
  if (!context) return
  context.save()
  context.strokeStyle = HIGHLIGHT_COLOR
  context.lineWidth = HIGHLIGHT_LINE_WIDTH * scale
  context.setLineDash([8 * scale, 4 * scale])
  context.strokeRect(
    (rect.left - HIGHLIGHT_PADDING) * scale,
    (rect.top - HIGHLIGHT_PADDING) * scale,
    (rect.width + HIGHLIGHT_PADDING * 2) * scale,
    (rect.height + HIGHLIGHT_PADDING * 2) * scale,
  )
  context.restore()
}
