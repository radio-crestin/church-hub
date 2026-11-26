/**
 * The first element down `path` from `element`, each step matched by local
 * name (`spPr`, `xfrm`, …), so a slide's `p:sp` and a SmartArt drawing's
 * `dsp:sp` read the same; null when a step is missing.
 */
export function xmlChild(
  element: Element | null | undefined,
  ...path: string[]
): Element | null {
  let current: Element | null = element ?? null
  for (const name of path) {
    if (!current) return null
    let next: Element | null = null
    for (const child of Array.from(current.children)) {
      if (child.localName === name) {
        next = child
        break
      }
    }
    current = next
  }
  return current
}
