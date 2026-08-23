/**
 * The font size the operator is looking at, expressed in the screen's own
 * canvas units — the same units the screen settings use.
 *
 * The slide canvas is a scaled-down copy of the screen, and the text inside it
 * is auto-fitted, so the pixel size on screen means nothing on its own. Dividing
 * the rendered size by the canvas scale gives a number that stays put while the
 * panel is resized, which is what makes it usable as a "font size" field.
 *
 * Measures the run the operator has selected, so a word that was enlarged
 * reports its own size rather than the slide's. The selection is passed in
 * rather than read from the DOM: typing in the size field moves the browser's
 * selection into that field, and measuring the slide as a whole while resizing a
 * single run makes the two disagree — the field would report one size and change
 * another, and never settle.
 *
 * @param canvasWidth the screen's width in canvas units
 * @param selection character offsets of the run being styled, or null for the
 *   whole slide
 * @returns the size, or null while the canvas is not on screen
 */
export function measureSlideFontSize(
  canvasWidth: number,
  selection: { start: number; end: number } | null,
): number | null {
  const editor = slideEditor()
  const scale = canvasScale(canvasWidth)
  if (!editor || scale === null) return null

  const measured =
    (selection ? elementAtOffset(editor, selection.start) : null) ?? editor
  const rendered = Number.parseFloat(getComputedStyle(measured).fontSize)
  if (!Number.isFinite(rendered)) return null

  return rendered / scale
}

/**
 * How much larger the slide's text can still get before it runs off the box —
 * 1 when it already fills it. Measured by the renderer, which is the only place
 * that knows how the styled markup lays out, and read back from the element it
 * records it on.
 */
export function measureSlideFontHeadroom(): number {
  const editor = slideEditor()
  const headroom = Number.parseFloat(editor?.dataset.fitHeadroom ?? '')
  if (!Number.isFinite(headroom) || headroom <= 0) return 1
  return headroom
}

function slideEditor(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '[data-testid="slide-canvas-editable"]',
  )
}

/** How much the canvas shrinks the screen, or null while it is not on screen. */
function canvasScale(canvasWidth: number): number | null {
  const box = document.querySelector<HTMLElement>(
    '[data-testid="slide-canvas-box"]',
  )
  if (!box || canvasWidth <= 0) return null

  const scale = box.clientWidth / canvasWidth
  if (!Number.isFinite(scale) || scale <= 0) return null
  return scale
}

/** The element rendering the character at `offset` in the editor's text. */
function elementAtOffset(
  editor: HTMLElement,
  offset: number,
): HTMLElement | null {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let seen = 0
  let current: Node | null = walker.nextNode()

  while (current) {
    const length = current.textContent?.length ?? 0
    // A boundary sitting at the very end of a node belongs to the next one —
    // `offset` is the first character of the selection, not the gap before it.
    if (seen + length > offset) {
      const parent = current.parentNode
      return parent instanceof HTMLElement ? parent : null
    }
    seen += length
    current = walker.nextNode()
  }

  return null
}
