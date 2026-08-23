/**
 * Character offsets of the operator's current selection inside the slide canvas
 * editor, or null when nothing is selected there.
 *
 * Offsets are counted over the editor's plain text, which is exactly the text
 * the projection renderer lays out, so a range recorded here lines up with what
 * ends up on the screen. Returns null for a collapsed caret — styling with no
 * selection is a whole-slide action, not a range one.
 */
export function getSlideSelection(): { start: number; end: number } | null {
  const editor = document.querySelector<HTMLElement>(
    '[data-testid="slide-canvas-editable"]',
  )
  if (!editor) return null

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null
  }

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return null

  const start = offsetOf(editor, range.startContainer, range.startOffset)
  const end = offsetOf(editor, range.endContainer, range.endOffset)
  if (start === null || end === null || start >= end) return null

  return { start, end }
}

/** Character offset of a DOM position from the start of the editor's text. */
function offsetOf(
  editor: HTMLElement,
  node: Node,
  nodeOffset: number,
): number | null {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let offset = 0
  let current: Node | null = walker.nextNode()

  while (current) {
    if (current === node) return offset + nodeOffset
    offset += current.textContent?.length ?? 0
    current = walker.nextNode()
  }

  // The selection boundary can sit on an element (e.g. selecting a whole line),
  // in which case every text node before it has already been counted.
  return node === editor ? offset : null
}
