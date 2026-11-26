import { placeholderOf } from './placeholderOf'
import { xmlDescendants } from '../xml/xmlDescendants'

/** On a master, a slide's kinds of placeholder are the master's few. */
const MASTER_TYPE: Record<string, string> = {
  ctrTitle: 'title',
  subTitle: 'body',
  obj: 'body',
}

const typeOf = (ph: Element) => ph.getAttribute('type') || 'body'

/**
 * The layout's or master's placeholder a slide's `p:ph` inherits from: the
 * same `idx` on a layout, else the same type (a master has one per type).
 */
export function findPlaceholder(
  doc: Document | null | undefined,
  ph: Element,
  onMaster: boolean,
): Element | null {
  if (!doc) return null
  const shapes = xmlDescendants(doc.documentElement, 'sp').filter(
    (shape) => placeholderOf(shape) !== null,
  )
  const idx = ph.getAttribute('idx')
  if (idx && !onMaster) {
    const byIdx = shapes.find(
      (shape) => placeholderOf(shape)?.getAttribute('idx') === idx,
    )
    if (byIdx) return byIdx
  }
  const type = onMaster ? (MASTER_TYPE[typeOf(ph)] ?? typeOf(ph)) : typeOf(ph)
  return (
    shapes.find((shape) => {
      const own = typeOf(placeholderOf(shape) as Element)
      return (onMaster ? (MASTER_TYPE[own] ?? own) : own) === type
    }) ?? null
  )
}
