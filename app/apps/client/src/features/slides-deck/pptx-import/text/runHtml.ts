import { getFontFamilyStack } from '~/features/presentation/utils/getFontFamilyStack'
import type { PptxRunStyle } from './types'
import { escapeHtml } from '../../utils/escapeHtml'
import { colorCss } from '../theme/colorCss'

/** The text box's own look, which runs only restate where they differ. */
export interface PptxBoxText {
  sizePt: number
  font?: string
  color?: string
}

const em = (value: number) => `${Math.round(value * 1000) / 1000}em`

/**
 * A run of text as HTML the deck keeps (sanitizeDeckHtml): bold, italic and
 * underline as tags, its size (in em of the box's, so autofit scales it),
 * colour and font in a span where they differ from the box's.
 */
export function runHtml(
  text: string,
  style: PptxRunStyle,
  box: PptxBoxText,
): string {
  let html = escapeHtml(style.caps ? text.toUpperCase() : text)
  if (!html) return ''
  if (style.underline) html = `<u>${html}</u>`
  if (style.italic) html = `<em>${html}</em>`
  if (style.bold) html = `<strong>${html}</strong>`
  const css: string[] = []
  const size = style.sizePt ?? box.sizePt
  if (Math.abs(size - box.sizePt) > 0.01) {
    css.push(`font-size: ${em(size / box.sizePt)}`)
  }
  const color = style.color ? colorCss(style.color) : undefined
  if (color && color !== box.color) css.push(`color: ${color}`)
  if (style.font && style.font !== box.font) {
    css.push(`font-family: ${getFontFamilyStack(style.font)}`)
  }
  return css.length ? `<span style="${css.join('; ')}">${html}</span>` : html
}
