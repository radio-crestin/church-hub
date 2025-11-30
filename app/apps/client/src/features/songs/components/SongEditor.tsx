import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

import { SlideBreak } from '../extensions/slide-break'

interface SongEditorProps {
  content: string
  onContentChange: (content: string) => void
}

export function SongEditor({ content, onContentChange }: SongEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
      }),
      SlideBreak,
    ],
    content,
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[300px] p-4 focus:outline-none',
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [editor, content])

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <EditorContent editor={editor} />
      <style>{`
        .slide-break {
          border: none;
          border-top: 2px dashed #6366f1;
          margin: 1rem 0;
          height: 0;
          position: relative;
        }
        .slide-break::after {
          content: 'Slide Break';
          position: absolute;
          top: -0.75rem;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 0 0.5rem;
          font-size: 0.75rem;
          color: #6366f1;
        }
        .dark .slide-break::after {
          background: #1f2937;
        }
      `}</style>
    </div>
  )
}
