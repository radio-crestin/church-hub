import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { FileText, Loader2, Megaphone, Plus, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDefaultBibleTranslation } from '~/features/bible'
import {
  type LocalVerseteTineriEntry,
  VerseteTineriEditor,
} from '~/features/queue/components/VerseteTineriEditor'
import { useToast } from '~/ui/toast'
import { useAddItemToSchedule, useUpdateScheduleSlide } from '../hooks'
import type { SlideTemplate } from '../types'

interface EditingItem {
  id: number
  slideType: SlideTemplate | null
  slideContent: string | null
}

interface InsertSlideModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleId: number
  /** For insert mode: ID of the item to insert after. If not provided, append to end. */
  afterItemId?: number
  /** For edit mode: the item being edited */
  editingItem?: EditingItem | null
  /** Pre-select a template when opening */
  initialTemplate?: SlideTemplate
  onSaved?: () => void
}

const TEMPLATES: { type: SlideTemplate; icon: typeof Megaphone }[] = [
  { type: 'announcement', icon: Megaphone },
  { type: 'versete_tineri', icon: FileText },
]

export function InsertSlideModal({
  isOpen,
  onClose,
  scheduleId,
  afterItemId,
  editingItem,
  initialTemplate,
  onSaved,
}: InsertSlideModalProps) {
  const { t } = useTranslation('queue')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const addItemMutation = useAddItemToSchedule()
  const updateMutation = useUpdateScheduleSlide()

  // Get default translation for versete tineri
  const { translation: defaultTranslation } = useDefaultBibleTranslation()

  const isEditMode = !!editingItem

  const [selectedTemplate, setSelectedTemplate] =
    useState<SlideTemplate>('announcement')
  const [content, setContent] = useState('')

  // Versete Tineri state
  const [verseteTineriEntries, setVerseteTineriEntries] = useState<
    LocalVerseteTineriEntry[]
  >([])

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
        autocorrect: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
      },
    },
  })

  // Dialog open/close handling
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
      // Load editing item data or reset state
      if (editingItem) {
        setSelectedTemplate(editingItem.slideType ?? 'announcement')
        setContent(editingItem.slideContent ?? '')
        editor?.commands.setContent(editingItem.slideContent ?? '')
        setVerseteTineriEntries([])
      } else {
        setSelectedTemplate(initialTemplate ?? 'announcement')
        setContent('')
        editor?.commands.setContent('')
        setVerseteTineriEntries([])
      }
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen, editor, editingItem, initialTemplate])

  const handleSave = async () => {
    // Handle Versete Tineri template
    if (selectedTemplate === 'versete_tineri') {
      // Validate entries
      const validEntries = verseteTineriEntries.filter(
        (entry) =>
          entry.personName.trim() && entry.parsedResult?.status === 'valid',
      )

      if (validEntries.length === 0) {
        showToast(t('verseteTineri.errorNoValidEntries'), 'error')
        return
      }

      if (!defaultTranslation) {
        showToast(t('verseteTineri.errorNoTranslation'), 'error')
        return
      }

      // Convert entries to HTML content for schedule slide
      const htmlContent = validEntries
        .map((entry) => {
          const name = escapeHtml(entry.personName.trim())
          const reference = escapeHtml(entry.parsedResult!.formattedReference!)
          return `<p><strong>${name}</strong> - ${reference}</p>`
        })
        .join('')

      if (isEditMode && editingItem) {
        const result = await updateMutation.mutateAsync({
          scheduleId,
          itemId: editingItem.id,
          input: {
            slideType: 'versete_tineri',
            slideContent: htmlContent,
          },
        })

        if (result.success) {
          showToast(t('messages.slideUpdated'), 'success')
          onSaved?.()
          onClose()
        } else {
          showToast(t('messages.error'), 'error')
        }
      } else {
        const result = await addItemMutation.mutateAsync({
          scheduleId,
          input: {
            slideType: 'versete_tineri',
            slideContent: htmlContent,
            afterItemId,
          },
        })

        if (result.success) {
          showToast(t('messages.slideInserted'), 'success')
          onSaved?.()
          onClose()
        } else {
          showToast(t('messages.error'), 'error')
        }
      }
      return
    }

    // Handle announcement template
    if (!content.trim()) {
      showToast(t('insertSlide.errorEmpty'), 'error')
      return
    }

    if (isEditMode && editingItem) {
      // Update existing slide
      const result = await updateMutation.mutateAsync({
        scheduleId,
        itemId: editingItem.id,
        input: {
          slideType: selectedTemplate,
          slideContent: content,
        },
      })

      if (result.success) {
        showToast(t('messages.slideUpdated'), 'success')
        onSaved?.()
        onClose()
      } else {
        showToast(t('messages.error'), 'error')
      }
    } else {
      // Insert new slide
      const result = await addItemMutation.mutateAsync({
        scheduleId,
        input: {
          slideType: selectedTemplate,
          slideContent: content,
          afterItemId,
        },
      })

      if (result.success) {
        showToast(t('messages.slideInserted'), 'success')
        onSaved?.()
        onClose()
      } else {
        showToast(t('messages.error'), 'error')
      }
    }
  }

  const handleClose = () => {
    if (!addItemMutation.isPending && !updateMutation.isPending) {
      onClose()
    }
  }

  const isPending = addItemMutation.isPending || updateMutation.isPending

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
            {isEditMode ? t('insertSlide.editTitle') : t('insertSlide.title')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Template Selector - only show in edit mode or when no initial template */}
          {(isEditMode || !initialTemplate) && (
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
          )}

          {/* Content Editor - Show VerseteTineriEditor for versete_tineri template */}
          {selectedTemplate === 'versete_tineri' ? (
            <VerseteTineriEditor
              entries={verseteTineriEntries}
              onEntriesChange={setVerseteTineriEntries}
            />
          ) : (
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
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 transition-colors"
          >
            <X size={16} />
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              isPending ||
              (selectedTemplate === 'versete_tineri'
                ? verseteTineriEntries.length === 0
                : !content.trim())
            }
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isEditMode ? (
              <Save size={16} />
            ) : (
              <Plus size={16} />
            )}
            {isEditMode ? t('insertSlide.save') : t('insertSlide.insert')}
          </button>
        </div>
      </div>
    </dialog>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
