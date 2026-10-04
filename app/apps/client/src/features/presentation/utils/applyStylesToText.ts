import type { TextStyleRange } from '../types'

/**
 * Underline drawn the same on every screen: thickness and offset scale with
 * the font, so the 300 px projector text and the small preview look alike,
 * and the line runs straight through descenders and cedillas (ş, ţ) instead
 * of breaking around them.
 */
const UNDERLINE_STYLE =
  'text-decoration-line: underline; text-decoration-thickness: 0.07em; text-underline-offset: 0.14em; text-decoration-skip-ink: none;'

/**
 * Apply text style ranges to plain text, returning HTML with styling tags.
 *
 * The text is cut wherever a range starts or ends and every piece gets its
 * own, properly nested tags. Overlapping ranges therefore never produce
 * crossed tags like `<u>a<mark>b</u>c</mark>`, which the HTML parser repairs
 * by dropping the style off part of the text.
 *
 * @param text - Plain text content
 * @param ranges - Array of style ranges to apply
 * @returns HTML string with styling tags applied
 */
export function applyStylesToText(
  text: string,
  ranges: TextStyleRange[],
): string {
  if (!ranges || ranges.length === 0) {
    return text
  }

  const usable = ranges
    .map((range) => {
      const start = Math.max(0, Math.min(range.start, text.length))
      const end = Math.max(start, Math.min(range.end, text.length))
      return { ...range, start, end }
    })
    .filter((range) => range.start < range.end)

  const cuts = [
    ...new Set([
      0,
      text.length,
      ...usable.flatMap((range) => [range.start, range.end]),
    ]),
  ].sort((a, b) => a - b)

  const pieces: string[] = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i]
    const end = cuts[i + 1]
    const covering = usable.filter(
      (range) => range.start <= start && range.end >= end,
    )
    pieces.push(wrapPiece(escapeHtml(text.slice(start, end)), covering))
  }

  return pieces.join('')
}

/**
 * Wraps one piece of text in the tags of every range covering it. When two
 * ranges set the same style, the later one names it (its id is what a right
 * click removes).
 */
function wrapPiece(html: string, covering: TextStyleRange[]): string {
  if (covering.length === 0) return html

  const last = (has: (range: TextStyleRange) => boolean) =>
    [...covering].reverse().find(has)

  const highlight = last((range) => Boolean(range.highlight))
  const bold = last((range) => Boolean(range.bold))
  const italic = last((range) => Boolean(range.italic))
  const underline = last((range) => Boolean(range.underline))
  const scaled = covering.filter(
    (range) => range.fontScale !== undefined && range.fontScale !== 1,
  )
  // Nested runs used to multiply their sizes through nested `em` spans; one
  // span with the product keeps that.
  const fontScale = scaled.reduce((total, range) => total * range.fontScale!, 1)

  let wrapped = html
  if (underline) {
    wrapped = `<u data-highlight-id="${escapeHtml(underline.id)}" style="${UNDERLINE_STYLE}">${wrapped}</u>`
  }
  if (italic) {
    wrapped = `<em data-highlight-id="${escapeHtml(italic.id)}">${wrapped}</em>`
  }
  if (bold) {
    wrapped = `<strong data-highlight-id="${escapeHtml(bold.id)}">${wrapped}</strong>`
  }
  if (scaled.length > 0) {
    wrapped = `<span data-highlight-id="${escapeHtml(scaled[scaled.length - 1].id)}" style="font-size: ${fontScale}em;">${wrapped}</span>`
  }
  if (highlight) {
    const color = escapeHtml(highlight.highlight ?? '')
    wrapped = `<mark data-color="${color}" data-highlight-id="${escapeHtml(highlight.id)}" style="background-color: ${color};">${wrapped}</mark>`
  }
  return wrapped
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
