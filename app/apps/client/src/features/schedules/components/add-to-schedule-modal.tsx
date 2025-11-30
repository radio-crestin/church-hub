import { Calendar, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAddScheduleItem, useCreateSchedule, useSchedules } from '../hooks'
import type { AddScheduleItemInput } from '../service/types'

interface AddToScheduleModalProps {
  isOpen: boolean
  itemType: AddScheduleItemInput['item_type']
  contentId?: number
  contentData?: string
  onClose: () => void
  onSuccess: () => void
}

export function AddToScheduleModal({
  isOpen,
  itemType,
  contentId,
  contentData,
  onClose,
  onSuccess,
}: AddToScheduleModalProps) {
  const { t } = useTranslation(['schedules', 'common'])

  const { data: schedules = [], isLoading } = useSchedules()
  const createScheduleMutation = useCreateSchedule()
  const addItemMutation = useAddScheduleItem()

  const [newScheduleTitle, setNewScheduleTitle] = useState('')
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  const isSubmitting =
    createScheduleMutation.isPending || addItemMutation.isPending

  const handleAddToExisting = async (scheduleId: number) => {
    const result = await addItemMutation.mutateAsync({
      scheduleId,
      input: {
        item_type: itemType,
        content_id: contentId,
        content_data: contentData,
      },
    })

    if (result.success) {
      onSuccess()
      handleClose()
    }
  }

  const handleCreateAndAdd = async () => {
    if (!newScheduleTitle.trim()) return

    const createResult = await createScheduleMutation.mutateAsync({
      title: newScheduleTitle.trim(),
    })

    if (createResult.success && createResult.id) {
      const addResult = await addItemMutation.mutateAsync({
        scheduleId: createResult.id,
        input: {
          item_type: itemType,
          content_id: contentId,
          content_data: contentData,
        },
      })

      if (addResult.success) {
        onSuccess()
        handleClose()
      }
    }
  }

  const handleClose = () => {
    setNewScheduleTitle('')
    setIsCreatingNew(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('schedules:modal.addToScheduleTitle')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : schedules.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('schedules:modal.selectSchedule')}
              </p>
              <div className="space-y-2">
                {schedules.map((schedule) => (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => handleAddToExisting(schedule.id)}
                    disabled={isSubmitting}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-gray-700 rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {schedule.title}
                      </p>
                      {schedule.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {schedule.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div className="pt-2">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {schedules.length > 0
                ? t('schedules:modal.orCreateNew')
                : t('schedules:modal.selectSchedule')}
            </p>
            {isCreatingNew ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newScheduleTitle}
                  onChange={(e) => setNewScheduleTitle(e.target.value)}
                  placeholder={t('schedules:modal.newSchedulePlaceholder')}
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newScheduleTitle.trim()) {
                      handleCreateAndAdd()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateAndAdd}
                  disabled={!newScheduleTitle.trim() || isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('schedules:actions.add')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-lg text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <Plus className="w-5 h-5" />
                {t('schedules:actions.create')}
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            {t('common:buttons.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
