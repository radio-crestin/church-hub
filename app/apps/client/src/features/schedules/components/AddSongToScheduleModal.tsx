import { Loader2, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { CreateScheduleModal } from './CreateScheduleModal'
import { ScheduleList } from './ScheduleList'
import { useAddItemToSchedule } from '../hooks'

interface AddSongToScheduleModalProps {
  isOpen: boolean
  songId: number
  onClose: () => void
  onAdded?: (scheduleId: number) => void
}

export function AddSongToScheduleModal({
  isOpen,
  songId,
  onClose,
  onAdded,
}: AddSongToScheduleModalProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const addToSchedule = useAddItemToSchedule()
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (e: Event) => {
      e.preventDefault()
      if (!addToSchedule.isPending) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose, addToSchedule.isPending])

  const handleScheduleSelect = async (scheduleId: number) => {
    const result = await addToSchedule.mutateAsync({
      scheduleId,
      input: { songId },
    })

    if (result.success) {
      showToast(t('messages.itemAdded'), 'success')
      onAdded?.(scheduleId)
      onClose()
    } else {
      showToast(t('messages.error'), 'error')
    }
  }

  const handleScheduleCreated = () => {
    // Just close the create modal - user will select the schedule manually
    setShowCreateModal(false)
  }

  const handleClose = () => {
    if (!addToSchedule.isPending) {
      onClose()
    }
  }

  return (
    <>
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
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('modal.addSongTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('modal.addSongDescription')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={addToSchedule.isPending}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {addToSchedule.isPending ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('modal.adding')}
                </p>
              </div>
            ) : (
              <>
                {/* Create New Schedule Button */}
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors font-medium"
                >
                  <Plus size={20} />
                  {t('modal.createNew')}
                </button>

                {/* Schedule List */}
                <ScheduleList onScheduleClick={handleScheduleSelect} />
              </>
            )}
          </div>
        </div>
      </dialog>

      {/* Create Schedule Modal */}
      <CreateScheduleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleScheduleCreated}
      />
    </>
  )
}
