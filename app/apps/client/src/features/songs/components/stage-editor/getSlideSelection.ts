import { offsetAtDomPosition } from '../../../presentation/utils/slideTextOffsets'

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

  const start = offsetAtDomPosition(
    editor,
    range.startContainer,
    range.startOffset,
  )
  const end = offsetAtDomPosition(editor, range.endContainer, range.endOffset)
  if (start === null || end === null || start >= end) return null

  return { start, end }
}
