import { findPlaceholder } from './findPlaceholder'
import { placeholderOf } from './placeholderOf'
import type { PptxShapeContext } from '../slide/types'

/** The layout's and master's placeholders a slide's placeholder shape inherits from. */
export function inheritedPlaceholders(
  shape: Element,
  context: PptxShapeContext,
): { layout: Element | null; master: Element | null } {
  const ph = placeholderOf(shape)
  if (!ph || context.level !== 'slide') return { layout: null, master: null }
  const { layout, master } = context.parts
  const onLayout = findPlaceholder(layout?.doc, ph, false)
  const layoutPh = onLayout ? placeholderOf(onLayout) : null
  return {
    layout: onLayout,
    master: findPlaceholder(master?.doc, layoutPh ?? ph, true),
  }
}
