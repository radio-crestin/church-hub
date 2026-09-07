import {
  elementAtOffset,
  elementsInRange,
} from '../../../presentation/utils/slideTextOffsets'

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
 * Every distinct size in the selection, smallest first, in canvas units.
 *
 * A selection can cross runs the operator sized separately, and the size field
 * has to say so rather than pick one of them: one entry means the whole
 * selection is that size, several mean it is mixed and the field shows the
 * smallest with a `+`, the way an operator reads a size box that cannot answer
 * with a single number.
 */
export function measureSlideFontSizes(
  canvasWidth: number,
  selection: { start: number; end: number } | null,
): number[] {
  const editor = slideEditor()
  const scale = canvasScale(canvasWidth)
  if (!editor || scale === null) return []

  const runs = selection
    ? elementsInRange(editor, selection.start, selection.end)
    : []
  // No styled run under the selection means it is all at the slide's own size.
  const measured = runs.length > 0 ? runs : [editor]

  const sizes: number[] = []
  for (const element of measured) {
    const rendered = Number.parseFloat(getComputedStyle(element).fontSize)
    if (!Number.isFinite(rendered)) continue
    const size = Math.round(rendered / scale)
    if (!sizes.includes(size)) sizes.push(size)
  }
  return sizes.sort((a, b) => a - b)
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
