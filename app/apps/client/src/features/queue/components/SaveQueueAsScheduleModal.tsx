import { Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useSaveQueueAsSchedule } from '../hooks'

interface SaveQueueAsScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: (scheduleId: number) => void
}

export function SaveQueueAsScheduleModal({
  isOpen,
  onClose,
  onSaved,
}: SaveQueueAsScheduleModalProps) {
  const { t } = useTranslation('queue')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const saveQueueAsSchedule = useSaveQueueAsSchedule()

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      dialogRef.current?.close()
      setTitle('')
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      e.preventDefault()
      if (!saveQueueAsSchedule.isPending) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, saveQueueAsSchedule.isPending])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const result = await saveQueueAsSchedule.mutateAsync(title.trim())

    if (result.success && result.data) {
      showToast(t('messages.savedAsProgram'), 'success')
      onSaved?.(result.data.scheduleId)
      onClose()
    } else {
      showToast(t('messages.error'), 'error')
    }
  }

  const handleClose = () => {
    if (!saveQueueAsSchedule.isPending) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto w-full max-w-sm p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose()
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('saveAsProgram.title')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={saveQueueAsSchedule.isPending}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <label
            htmlFor="program-title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {t('saveAsProgram.nameLabel')}
          </label>
          <input
            ref={inputRef}
            id="program-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saveQueueAsSchedule.isPending}
            placeholder={t('saveAsProgram.namePlaceholder')}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white disabled:opacity-50"
            autoComplete="off"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={saveQueueAsSchedule.isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {t('saveAsProgram.cancel')}
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saveQueueAsSchedule.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {saveQueueAsSchedule.isPending && (
              <Loader2 size={16} className="animate-spin" />
            )}
            {t('saveAsProgram.save')}
          </button>
        </div>
      </form>
    </dialog>
  )
}
