import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

/** Where the first text block's text starts and the last one's ends. */
function textBounds(doc: ProseMirrorNode) {
  let first: { pos: number; node: ProseMirrorNode } | null = null
  let lastEnd = -1
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    if (!first) first = { pos, node }
    lastEnd = pos + 1 + node.content.size
    return false
  })
  return first
    ? { first: first as { pos: number; node: ProseMirrorNode }, lastEnd }
    : null
}

/**
 * Replaces all of the text (a select-all, or a selection over all of it)
 * with `text`, keeping the first paragraph (its alignment, spacing, list
 * item) and its first words' marks (bold, colour, font, size), as
 * PowerPoint does when a whole title is typed over. False when the
 * selection is not all the text.
 */
function replaceAll(view: EditorView, text: string): boolean {
  const { state } = view
  const bounds = textBounds(state.doc)
  if (!bounds) return false
  const from = bounds.first.pos + 1
  const { to: selectionTo, from: selectionFrom } = state.selection
  if (selectionFrom > from || selectionTo < bounds.lastEnd) return false
  if (from >= bounds.lastEnd && !text) return false
  const marks = bounds.first.node.firstChild?.marks ?? []
  const tr = text
    ? state.tr.replaceWith(from, bounds.lastEnd, state.schema.text(text, marks))
    : state.tr.delete(from, bounds.lastEnd)
  tr.setSelection(TextSelection.create(tr.doc, from + text.length))
  tr.setStoredMarks(marks)
  view.dispatch(tr.scrollIntoView())
  return true
}

/**
 * Typing over (or deleting) all of a text box's text keeps its look instead
 * of starting a plain, left-aligned paragraph.
 */
export const KeepStyleOnReplaceAll = Extension.create({
  name: 'keepStyleOnReplaceAll',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput: (view, _from, _to, text) => replaceAll(view, text),
          handleKeyDown: (view, event) =>
            (event.key === 'Backspace' || event.key === 'Delete') &&
            !view.state.selection.empty &&
            replaceAll(view, ''),
        },
      }),
    ]
  },
})
