import { Loader2, Save, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDefaultBibleTranslation } from '~/features/bible'
import { useToast } from '~/ui/toast'
import {
  type LocalVerseteTineriEntry,
  VerseteTineriEditor,
} from './VerseteTineriEditor'
import { useUpdateScheduleSlide } from '../hooks'
import type { ScheduleVerseteTineriEntry } from '../types'

interface EditVerseteTineriModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleId: number
  itemId: number
  entries: ScheduleVerseteTineriEntry[]
  onSaved?: () => void
}

export function EditVerseteTineriModal({
  isOpen,
  onClose,
  scheduleId,
  itemId,
  entries,
  onSaved,
}: EditVerseteTineriModalProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const updateMutation = useUpdateScheduleSlide()

  const { translation: defaultTranslation } = useDefaultBibleTranslation()

  const [verseteTineriEntries, setVerseteTineriEntries] = useState<
    LocalVerseteTineriEntry[]
  >([])

  // Load entries when modal opens
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()

      // Convert server entries to local format
      const localEntries: LocalVerseteTineriEntry[] = entries.map((entry) => ({
        id: entry.id,
        personName: entry.personName,
        referenceInput: entry.reference,
        parsedResult: {
          status: 'valid' as const,
          bookCode: entry.bookCode,
          bookName: entry.bookName,
          startChapter: entry.startChapter,
          startVerse: entry.startVerse,
          endChapter: entry.endChapter,
          endVerse: entry.endVerse,
        },
        sortOrder: entry.sortOrder,
      }))
      setVerseteTineriEntries(localEntries)
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen, entries])

  const handleSave = async () => {
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

    // Convert entries to structured format
    const structuredEntries = validEntries.map((entry) => ({
      personName: entry.personName.trim(),
      translationId: defaultTranslation.id,
      bookCode: entry.parsedResult!.bookCode!,
      bookName: entry.parsedResult!.bookName!,
      startChapter: entry.parsedResult!.startChapter!,
      startVerse: entry.parsedResult!.startVerse!,
      endChapter: entry.parsedResult!.endChapter!,
      endVerse: entry.parsedResult!.endVerse!,
    }))

    const result = await updateMutation.mutateAsync({
      scheduleId,
      itemId,
      input: {
        slideType: 'versete_tineri',
        verseteTineriEntries: structuredEntries,
      },
    })

    if (result.success) {
      showToast(t('messages.slideUpdated'), 'success')
      onSaved?.()
      onClose()
    } else {
      showToast(t('messages.error'), 'error')
    }
  }

  const handleClose = () => {
    if (!updateMutation.isPending) {
      onClose()
    }
  }

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      handleClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className="fixed inset-0 m-auto w-full max-w-xl p-0 rounded-lg bg-white dark:bg-gray-800 backdrop:bg-black/50"
    >
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('slideTemplates.versete_tineri')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={updateMutation.isPending}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <VerseteTineriEditor
            entries={verseteTineriEntries}
            onEntriesChange={setVerseteTineriEntries}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 transition-colors"
          >
            <X size={16} />
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              updateMutation.isPending || verseteTineriEntries.length === 0
            }
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {t('insertSlide.save')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
