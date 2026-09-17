import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useUpsertSchedule } from '../hooks'
import type { Schedule } from '../types'

interface RenameScheduleModalProps {
  /** The program being renamed; `null` keeps the dialog closed. */
  schedule: Pick<Schedule, 'id' | 'title' | 'description'> | null
  onClose: () => void
}

export function RenameScheduleModal({
  schedule,
  onClose,
}: RenameScheduleModalProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const upsertSchedule = useUpsertSchedule()
  const isOpen = schedule !== null

  useEffect(() => {
    if (!schedule) {
      dialogRef.current?.close()
      return
    }
    setTitle(schedule.title)
    dialogRef.current?.showModal()
    // Focus input after modal opens, with the old name selected to type over
    setTimeout(() => inputRef.current?.select(), 100)
  }, [schedule])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      e.preventDefault()
      if (!upsertSchedule.isPending) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, upsertSchedule.isPending])

  const trimmedTitle = title.trim()
  const canSave =
    isOpen &&
    trimmedTitle !== '' &&
    trimmedTitle !== schedule.title &&
    !upsertSchedule.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schedule || !canSave) return

    // The upsert rewrites the description too, so the current one rides along.
    const result = await upsertSchedule.mutateAsync({
      id: schedule.id,
      title: trimmedTitle,
      description: schedule.description,
    })

    if (result.success && result.data) {
      showToast(t('messages.saved'), 'success')
      onClose()
    } else {
      showToast(t('messages.error'), 'error')
    }
  }

  const handleClose = () => {
    if (!upsertSchedule.isPending) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose()
      }}
      data-testid="rename-schedule-modal"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('modal.renameTitle')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={upsertSchedule.isPending}
            aria-label={t('modal.cancel')}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <label
            htmlFor="rename-schedule-title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {t('modal.scheduleName')}
          </label>
          <input
            ref={inputRef}
            id="rename-schedule-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={upsertSchedule.isPending}
            placeholder={t('editor.titlePlaceholder')}
            data-testid="rename-schedule-input"
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white disabled:opacity-50"
            autoComplete="off"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={upsertSchedule.isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {t('modal.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canSave}
            data-testid="rename-schedule-save"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {upsertSchedule.isPending && (
              <Loader2 size={16} className="animate-spin" />
            )}
            {t('actions.save')}
          </button>
        </div>
      </form>
    </dialog>
  )
}
