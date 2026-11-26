import type { PptxRgba } from './types'

/** A colour as the deck stores it: `#rrggbb`, or `rgba()` when see-through. */
export function colorCss({ r, g, b, a }: PptxRgba): string {
  if (a < 1) return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
