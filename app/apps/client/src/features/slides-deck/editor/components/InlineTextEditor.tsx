import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import { useEffect } from 'react'

import { getFontFamilyStack } from '~/features/presentation/utils/getFontFamilyStack'
import type { DeckShapeElement, DeckTextElement } from '../../types'
import { deckTextExtensions } from '../utils/deckTextExtensions'

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }

interface InlineTextEditorProps {
  element: DeckTextElement | DeckShapeElement
  /** Screen pixels per design pixel. */
  scale: number
  onChange: (html: string) => void
  /** The live editor, for the Design tab's bold, italic, alignment, lists. */
  onEditor: (editor: Editor | null) => void
  onDone: () => void
}

/**
 * A text box's (or shape's) text edited in place, drawn as on the slide, with
 * the text editor (TipTap) kept to what a deck's text may hold. Escape or a
 * click elsewhere ends it.
 */
export function InlineTextEditor({
  element,
  scale,
  onChange,
  onEditor,
  onDone,
}: InlineTextEditorProps) {
  const text = element.type === 'text' ? element : null
  const editor = useEditor({
    extensions: deckTextExtensions(),
    content: element.html ?? '',
    autofocus: 'end',
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        'data-testid': 'deck-editor-text-input',
        class:
          'h-full outline-none [&_ol]:list-decimal [&_ol]:pl-[1.2em] [&_ul]:list-disc [&_ul]:pl-[1.2em]',
      },
      handleKeyDown: (_view, event) => {
        if (event.key !== 'Escape') return false
        onDone()
        return true
      },
    },
  })

  useEffect(() => {
    onEditor(editor)
    return () => onEditor(null)
  }, [editor, onEditor])

  return (
    <div
      className="absolute top-0 left-0"
      style={{
        width: element.w,
        height: element.h,
        transform: `translate(${element.x * scale}px, ${element.y * scale}px) scale(${scale}) rotate(${element.rotation ?? 0}deg)`,
        transformOrigin: '0 0',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden break-words outline-2 outline-focus outline-dashed"
        style={{
          justifyContent: JUSTIFY[text?.verticalAlign ?? 'middle'],
          padding: text?.padding ?? 0,
          fontFamily: getFontFamilyStack(text?.fontFamily),
          fontSize: text
            ? (text.fontSize ?? 40) * (text.autofitScale ?? 1)
            : 32,
          color: text?.color ?? '#ffffff',
          lineHeight: 1.2,
          textAlign: text ? undefined : 'center',
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
