import { AlertCircle, Book, Check, Loader2, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type ParsedPassageRange,
  parsePassageRange,
  useBooks,
  useDefaultBibleTranslation,
} from '~/features/bible'
import { useToast } from '~/ui/toast'
import { useAddItemToSchedule, useUpdateScheduleSlide } from '../hooks'

interface EditingBiblePassage {
  id: number
  biblePassageReference: string | null
}

interface BiblePassagePickerModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleId: number
  afterItemId?: number
  /** For edit mode: the item being edited */
  editingItem?: EditingBiblePassage | null
  onSaved?: () => void
}

export function BiblePassagePickerModal({
  isOpen,
  onClose,
  scheduleId,
  afterItemId,
  editingItem,
  onSaved,
}: BiblePassagePickerModalProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addItemMutation = useAddItemToSchedule()
  const updateMutation = useUpdateScheduleSlide()

  const isEditMode = !!editingItem

  // Selection state
  const [referenceInput, setReferenceInput] = useState('')
  const [parsedResult, setParsedResult] = useState<ParsedPassageRange | null>(
    null,
  )

  // Fetch data - use default translation from settings
  const { translation: selectedTranslation } = useDefaultBibleTranslation()
  const { data: books = [] } = useBooks(selectedTranslation?.id ?? 0)

  // Debounced parsing
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!referenceInput.trim()) {
        setParsedResult(null)
        return
      }

      if (books.length === 0) return

      const result = parsePassageRange({
        input: referenceInput,
        books,
      })
      setParsedResult(result)
    }, 300)

    return () => clearTimeout(timeout)
  }, [referenceInput, books])

  // Dialog open/close handling
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
      // Load editing item data or reset state
      if (editingItem?.biblePassageReference) {
        setReferenceInput(editingItem.biblePassageReference)
      } else {
        setReferenceInput('')
      }
      setParsedResult(null)
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen, editingItem])

  const isPending = addItemMutation.isPending || updateMutation.isPending

  const handleClose = () => {
    if (!isPending) {
      onClose()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      handleClose()
    }
  }

  const handleSave = async () => {
    if (!parsedResult || parsedResult.status !== 'valid') {
      return
    }

    if (!selectedTranslation) {
      showToast(t('messages.error'), 'error')
      return
    }

    const biblePassageData = {
      translationId: selectedTranslation.id,
      translationAbbreviation: selectedTranslation.abbreviation,
      bookCode: parsedResult.bookCode!,
      bookName: parsedResult.bookName!,
      startChapter: parsedResult.startChapter!,
      startVerse: parsedResult.startVerse!,
      endChapter: parsedResult.endChapter!,
      endVerse: parsedResult.endVerse!,
    }

    if (isEditMode && editingItem) {
      // Update existing Bible passage
      const result = await updateMutation.mutateAsync({
        scheduleId,
        itemId: editingItem.id,
        input: {
          biblePassage: biblePassageData,
        },
      })

      if (result.success) {
        showToast(t('messages.biblePassageUpdated'), 'success')
        onSaved?.()
        onClose()
      } else {
        showToast(t('messages.error'), 'error')
      }
    } else {
      // Add new Bible passage
      const result = await addItemMutation.mutateAsync({
        scheduleId,
        input: {
          biblePassage: biblePassageData,
          afterItemId,
        },
      })

      if (result.success) {
        showToast(t('messages.biblePassageInserted'), 'success')
        onSaved?.()
        onClose()
      } else {
        showToast(t('messages.error'), 'error')
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && parsedResult?.status === 'valid') {
      handleSave()
    }
  }

  const isValid = parsedResult?.status === 'valid'

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleClose}
      onClick={handleBackdropClick}
      className="fixed inset-0 m-auto w-full max-w-lg p-0 rounded-lg bg-white dark:bg-gray-800 backdrop:bg-black/50"
    >
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Book size={20} className="text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditMode
                ? t('biblePassage.editTitle')
                : t('biblePassage.title')}
            </h2>
          </div>
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
          {/* Reference Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('biblePassage.reference')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('biblePassage.referencePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('biblePassage.referenceHint')}
            </p>
          </div>

          {/* Validation Feedback */}
          {parsedResult && (
            <div
              className={`p-3 rounded-lg border ${
                isValid
                  ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800'
                  : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
              }`}
            >
              {isValid ? (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-teal-800 dark:text-teal-200">
                    {parsedResult.formattedReference}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400">
                    <Check size={16} />
                    {t('biblePassage.valid')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertCircle size={16} />
                  <span>{t(parsedResult.errorKey!)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !isValid}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isEditMode ? (
              <Save size={18} />
            ) : null}
            {isEditMode ? t('biblePassage.save') : t('biblePassage.add')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
