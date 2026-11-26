import { type Editor, useEditorState } from '@tiptap/react'

/** The font, size (design pixels) and colour a text box's selected words show. */
export interface SelectionTextStyle {
  fontFamily?: string
  fontSize?: number
  color?: string
}

/** The first family of a CSS font stack, unquoted: what the Font picker names. */
function firstFamily(stack: string | undefined): string | undefined {
  return stack
    ?.split(',')[0]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2')
}

/**
 * While a text box is edited in place, the look of the words its selection
 * starts in (their `<span style>`, else the box's own `box`), kept up to date
 * as the selection moves; the box's own look when it is not edited.
 */
export function useSelectionTextStyle(
  editor: Editor | null,
  box: SelectionTextStyle,
): SelectionTextStyle {
  const selected = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const attrs = e?.getAttributes('textStyle') ?? {}
      return {
        fontFamily: attrs.fontFamily as string | undefined,
        fontSize: attrs.fontSize as string | undefined,
        color: attrs.color as string | undefined,
      }
    },
  })
  const size = selected?.fontSize
  const sizePx = size?.endsWith('em')
    ? Number.parseFloat(size) * (box.fontSize ?? 40)
    : size?.endsWith('px')
      ? Number.parseFloat(size)
      : undefined
  return {
    fontFamily: firstFamily(selected?.fontFamily) ?? box.fontFamily,
    fontSize:
      sizePx === undefined ? box.fontSize : Math.round(sizePx * 100) / 100,
    color: selected?.color ?? box.color,
  }
}
