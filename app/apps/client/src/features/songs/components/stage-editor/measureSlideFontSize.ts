/**
 * The font size the operator is looking at, expressed in the screen's own
 * canvas units — the same units the screen settings use.
 *
 * The slide canvas is a scaled-down copy of the screen, and the text inside it
 * is auto-fitted, so the pixel size on screen means nothing on its own. Dividing
 * the rendered size by the canvas scale gives a number that stays put while the
 * panel is resized, which is what makes it usable as a "font size" field.
 *
 * Measures the run under the caret when there is one, so a word that was
 * enlarged reports its own size rather than the slide's.
 *
 * @param canvasWidth the screen's width in canvas units
 * @returns the size, or null while the canvas is not on screen
 */
export function measureSlideFontSize(canvasWidth: number): number | null {
  const editor = document.querySelector<HTMLElement>(
    '[data-testid="slide-canvas-editable"]',
  )
  const box = document.querySelector<HTMLElement>(
    '[data-testid="slide-canvas-box"]',
  )
  if (!editor || !box || canvasWidth <= 0) return null

  const canvasScale = box.clientWidth / canvasWidth
  if (!Number.isFinite(canvasScale) || canvasScale <= 0) return null

  const measured = elementAtSelection(editor) ?? editor
  const rendered = Number.parseFloat(getComputedStyle(measured).fontSize)
  if (!Number.isFinite(rendered)) return null

  return rendered / canvasScale
}

/** The element holding the current selection, when it sits inside the editor. */
function elementAtSelection(editor: HTMLElement): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const node = selection.getRangeAt(0).startContainer
  if (!editor.contains(node)) return null

  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode
  return element instanceof HTMLElement ? element : null
}
