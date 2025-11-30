import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast/useToast'
import { useUpsertSlide } from '../hooks'
import type { Slide, SlideContent, UpsertSlideInput } from '../types'
import { getDefaultSlideContent } from '../types'

interface SlideEditorModalProps {
  isOpen: boolean
  onClose: () => void
  programId: number
  slide: Slide | null
}

export function SlideEditorModal({
  isOpen,
  onClose,
  programId,
  slide,
}: SlideEditorModalProps) {
  const { t } = useTranslation('programs')
  const { addToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const upsertSlide = useUpsertSlide()

  const [content, setContent] = useState<SlideContent>(getDefaultSlideContent())

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: content.html || '',
    onUpdate: ({ editor }) => {
      setContent((prev) => ({ ...prev, html: editor.getHTML() }))
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-lg dark:prose-invert max-w-none min-h-[200px] p-4 focus:outline-none',
      },
    },
  })

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
      if (slide) {
        setContent(slide.content)
        editor?.commands.setContent(slide.content.html || '')
      } else {
        const defaultContent = getDefaultSlideContent()
        setContent(defaultContent)
        editor?.commands.setContent('')
      }
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen, slide, editor])

  const handleSave = async () => {
    const input: UpsertSlideInput = {
      programId,
      content,
      type: content.type,
    }

    if (slide) {
      input.id = slide.id
    }

    try {
      await upsertSlide.mutateAsync(input)
      addToast({ type: 'success', message: t('slides.messages.saved') })
      onClose()
    } catch {
      addToast({ type: 'error', message: t('slides.messages.saveFailed') })
    }
  }

  const handleClose = () => {
    if (!upsertSlide.isPending) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleClose}
      className="w-full max-w-2xl p-0 rounded-lg bg-white dark:bg-gray-800 backdrop:bg-black/50"
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {slide ? t('slides.editSlide') : t('slides.newSlide')}
          </h2>
          <button
            onClick={handleClose}
            disabled={upsertSlide.isPending}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <button
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  editor?.isActive('bold')
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                B
              </button>
              <button
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={`px-3 py-1 rounded text-sm font-medium italic ${
                  editor?.isActive('italic')
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                I
              </button>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
              <button
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 1 }).run()
                }
                className={`px-3 py-1 rounded text-sm font-medium ${
                  editor?.isActive('heading', { level: 1 })
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                H1
              </button>
              <button
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 2 }).run()
                }
                className={`px-3 py-1 rounded text-sm font-medium ${
                  editor?.isActive('heading', { level: 2 })
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                H2
              </button>
            </div>

            {/* Editor Content */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <EditorContent editor={editor} />
            </div>

            {/* Preview hint */}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('slides.editorHint')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={upsertSlide.isPending}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            {t('actions.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={upsertSlide.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {upsertSlide.isPending && (
              <Loader2 size={18} className="animate-spin" />
            )}
            {t('actions.save')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
