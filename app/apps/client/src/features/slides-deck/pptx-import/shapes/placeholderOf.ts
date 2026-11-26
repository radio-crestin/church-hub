import { xmlChild } from '../xml/xmlChild'

/** A shape's `p:ph`, when it is a placeholder (a picture's or a shape's). */
export function placeholderOf(shape: Element): Element | null {
  for (const props of ['nvSpPr', 'nvPicPr', 'nvGraphicFramePr']) {
    const ph = xmlChild(shape, props, 'nvPr', 'ph')
    if (ph) return ph
  }
  return null
}
