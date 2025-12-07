import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { FileText, Loader2, Megaphone, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useInsertSlideToQueue } from '../hooks'
import type { SlideTemplate } from '../types'

interface InsertSlideModalProps {
  isOpen: boolean
  onClose: () => void
  afterItemId: number
  onInserted?: () => void
}

const TEMPLATES: { type: SlideTemplate; icon: typeof Megaphone }[] = [
  { type: 'announcement', icon: Megaphone },
  { type: 'versete_tineri', icon: FileText },
]

export function InsertSlideModal({
  isOpen,
  onClose,
  afterItemId,
  onInserted,
}: InsertSlideModalProps) {
  const { t } = useTranslation('queue')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const insertMutation = useInsertSlideToQueue()

  const [selectedTemplate, setSelectedTemplate] =
    useState<SlideTemplate>('announcement')
  const [content, setContent] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[150px] p-4 focus:outline-none bg-white dark:bg-gray-900 prose prose-sm dark:prose-invert max-w-none',
      },
    },
  })

  // Dialog open/close handling
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
      // Reset state
      setSelectedTemplate('announcement')
      setContent('')
      editor?.commands.setContent('')
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen, editor])

  const handleInsert = async () => {
    if (!content.trim()) {
      showToast(t('insertSlide.errorEmpty'), 'error')
      return
    }

    const result = await insertMutation.mutateAsync({
      slideType: selectedTemplate,
      slideContent: content,
      afterItemId,
    })

    if (result.success) {
      showToast(t('messages.slideInserted'), 'success')
      onInserted?.()
      onClose()
    } else {
      showToast(t('messages.error'), 'error')
    }
  }

  const handleClose = () => {
    if (!insertMutation.isPending) {
      onClose()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      handleClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleClose}
      onClick={handleBackdropClick}
      className="fixed inset-0 m-auto w-full max-w-xl p-0 rounded-lg bg-white dark:bg-gray-800 backdrop:bg-black/50"
    >
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('insertSlide.title')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={insertMutation.isPending}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Template Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('insertSlide.selectTemplate')}
            </label>
            <div className="flex gap-2">
              {TEMPLATES.map(({ type, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedTemplate(type)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                    selectedTemplate === type
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">
                    {t(`slideTemplates.${type}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('insertSlide.content')}
            </label>
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={`px-2 py-1 rounded text-sm font-bold ${
                  editor?.isActive('bold')
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                B
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={`px-2 py-1 rounded text-sm italic ${
                  editor?.isActive('italic')
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                I
              </button>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
              <button
                type="button"
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 1 }).run()
                }
                className={`px-2 py-1 rounded text-sm ${
                  editor?.isActive('heading', { level: 1 })
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                H1
              </button>
              <button
                type="button"
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 2 }).run()
                }
                className={`px-2 py-1 rounded text-sm ${
                  editor?.isActive('heading', { level: 2 })
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                H2
              </button>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-b-lg overflow-hidden">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={insertMutation.isPending}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={insertMutation.isPending || !content.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {insertMutation.isPending && (
              <Loader2 size={18} className="animate-spin" />
            )}
            {t('insertSlide.insert')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
