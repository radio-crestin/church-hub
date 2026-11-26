import type { PptxRgba } from '../theme/types'

/** A run's look, as far as it is set. */
export interface PptxRunStyle {
  sizePt?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: PptxRgba
  /** The typeface, `+mj-lt`/`+mn-lt` already the theme's font. */
  font?: string
  caps?: boolean
}

/** A paragraph's look, as far as it is set, with its runs' defaults. */
export interface PptxParagraphStyle {
  align?: 'left' | 'center' | 'right' | 'justify'
  /** EMU. */
  marginLeft?: number
  bullet?: 'none' | 'char' | 'number'
  /** Of a single line (1 = 100 %), or in points. */
  lineSpacing?: { percent: number } | { points: number }
  spaceBefore?: { percent: number } | { points: number }
  spaceAfter?: { percent: number } | { points: number }
  run: PptxRunStyle
}

/** A text body's frame: anchoring, insets (EMU) and autofit. */
export interface PptxBodyStyle {
  anchor?: 'top' | 'middle' | 'bottom'
  insetLeft?: number
  insetTop?: number
  insetRight?: number
  insetBottom?: number
  /** `normAutofit fontScale`, 1 = none. */
  fontScale?: number
  lineSpacingReduction?: number
}
