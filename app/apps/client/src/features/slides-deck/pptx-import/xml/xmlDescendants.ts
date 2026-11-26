/** Every element under `element` (document order) with the local name `name`. */
export function xmlDescendants(
  element: Element | null | undefined,
  name: string,
): Element[] {
  if (!element) return []
  return Array.from(element.getElementsByTagName('*')).filter(
    (node) => node.localName === name,
  )
}
