import { Loader2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { ScheduleList } from './ScheduleList'
import { useImportScheduleToQueue } from '../hooks'

interface SchedulePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onImported?: () => void
}

export function SchedulePickerModal({
  isOpen,
  onClose,
  onImported,
}: SchedulePickerModalProps) {
  const { t } = useTranslation(['schedules', 'queue'])
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const importToQueue = useImportScheduleToQueue()

  // Dialog open/close handling
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      e.preventDefault()
      if (!importToQueue.isPending) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, importToQueue.isPending])

  const handleScheduleSelect = async (scheduleId: number) => {
    const success = await importToQueue.mutateAsync(scheduleId)

    if (success) {
      showToast(t('schedules:messages.importedToQueue'), 'success')
      onImported?.()
      onClose()
    } else {
      showToast(t('schedules:messages.error'), 'error')
    }
  }

  const handleClose = () => {
    if (!importToQueue.isPending) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto w-full max-w-lg p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose()
      }}
    >
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('queue:importSchedule.title')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={importToQueue.isPending}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {importToQueue.isPending ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('queue:importSchedule.importing')}
              </p>
            </div>
          ) : (
            <ScheduleList onScheduleClick={handleScheduleSelect} />
          )}
        </div>
      </div>
    </dialog>
  )
}
