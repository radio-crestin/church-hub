/**
 * Mapping between the slide editor's DOM and the plain text its style ranges
 * are recorded against.
 *
 * The editor is seeded two different ways. Plain text goes in through
 * `innerText`, and the browser turns every `\n` into a `<br>` element — which
 * holds no characters at all. Styled text goes in as markup, where the same
 * `\n` stays a real character inside a text node and only *renders* as a break
 * because of `white-space: pre-wrap`. Counting the selection over text nodes
 * alone therefore answers differently on the same slide depending on which way
 * it was last seeded: on the `innerText` path every offset comes out short by
 * the number of line breaks before it, so a size applied to a multi-line
 * selection lands shifted, and the last characters of the selection — one per
 * line it spans — never get it.
 *
 * Every offset here is counted the way `innerText` reads the editor back: a
 * text node contributes its characters, a `<br>` contributes one, so both
 * seeding paths and the string the ranges are applied to all agree.
 */

/** Characters `node` contributes to the editor's plain text. */
function lengthOf(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0
  if (node.nodeName === 'BR') return 1
  let total = 0
  for (const child of Array.from(node.childNodes)) total += lengthOf(child)
  return total
}

/** Characters before `node` starts, counting from the top of `root`. */
function offsetBefore(root: HTMLElement, node: Node): number {
  let total = 0
  let current: Node | null = node
  while (current && current !== root) {
    let sibling = current.previousSibling
    while (sibling) {
      total += lengthOf(sibling)
      sibling = sibling.previousSibling
    }
    current = current.parentNode
  }
  return total
}

/**
 * Character offset of a DOM position (a container plus its offset, as a
 * `Range` reports it), or null when the position is outside `root`.
 *
 * A boundary that lands on an element rather than inside a text node — which is
 * what selecting a whole line or the whole slide produces — is resolved to the
 * child it points at, so it counts the same as any other position instead of
 * being rejected.
 */
export function offsetAtDomPosition(
  root: HTMLElement,
  node: Node,
  nodeOffset: number,
): number | null {
  if (node !== root && !root.contains(node)) return null

  if (node.nodeType === Node.ELEMENT_NODE) {
    const children = Array.from(node.childNodes)
    if (nodeOffset >= children.length) {
      // Past the last child: everything inside this element is before it.
      return offsetBefore(root, node) + lengthOf(node)
    }
    return offsetBefore(root, children[nodeOffset])
  }

  return offsetBefore(root, node) + nodeOffset
}

/** DOM position for a character offset, for putting a selection back. */
export function domPositionAtOffset(
  root: HTMLElement,
  offset: number,
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  )
  let seen = 0
  let lastText: { node: Node; offset: number } | null = null
  let current: Node | null = walker.nextNode()

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const length = current.textContent?.length ?? 0
      if (seen + length >= offset)
        return { node: current, offset: offset - seen }
      seen += length
      lastText = { node: current, offset: length }
    } else if (current.nodeName === 'BR') {
      // The break is one character. A position on it is the gap in front of it,
      // i.e. the end of the line it closes.
      if (seen >= offset) {
        const parent = current.parentNode
        if (parent) {
          return {
            node: parent,
            offset: Array.from(parent.childNodes).indexOf(current as ChildNode),
          }
        }
      }
      seen += 1
    }
    current = walker.nextNode()
  }

  return lastText ?? { node: root, offset: 0 }
}

/**
 * The element rendering the character at `offset` — what a computed style is
 * read from to report the size of a run.
 */
export function elementAtOffset(
  root: HTMLElement,
  offset: number,
): HTMLElement | null {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  )
  let seen = 0
  let current: Node | null = walker.nextNode()

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const length = current.textContent?.length ?? 0
      // A boundary sitting at the very end of a node belongs to the next one —
      // `offset` is the first character of the selection, not the gap before it.
      if (seen + length > offset) {
        const parent = current.parentNode
        return parent instanceof HTMLElement ? parent : null
      }
      seen += length
    } else if (current.nodeName === 'BR') {
      seen += 1
    }
    current = walker.nextNode()
  }

  return null
}

/** Every distinct element rendering the characters in `[start, end)`. */
export function elementsInRange(
  root: HTMLElement,
  start: number,
  end: number,
): HTMLElement[] {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  )
  const found: HTMLElement[] = []
  let seen = 0
  let current: Node | null = walker.nextNode()

  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const length = current.textContent?.length ?? 0
      // Any overlap at all counts: a run is styled as a whole, so a selection
      // that touches part of it is looking at that run's size.
      if (seen < end && seen + length > start) {
        const parent = current.parentNode
        if (parent instanceof HTMLElement && !found.includes(parent)) {
          found.push(parent)
        }
      }
      seen += length
    } else if (current.nodeName === 'BR') {
      seen += 1
    }
    current = walker.nextNode()
  }

  return found
}
