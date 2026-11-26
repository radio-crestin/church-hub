/** The child elements of `element`, only those named `name` when given. */
export function xmlChildren(
  element: Element | null | undefined,
  name?: string,
): Element[] {
  if (!element) return []
  const all = Array.from(element.children)
  return name ? all.filter((child) => child.localName === name) : all
}
