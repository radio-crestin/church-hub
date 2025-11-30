import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  CreateScheduleInput,
  Schedule,
  UpdateScheduleInput,
} from '../service/types'

interface ScheduleModalProps {
  isOpen: boolean
  schedule: Schedule | null
  onClose: () => void
  onSave: (
    input: CreateScheduleInput | UpdateScheduleInput,
  ) => void | Promise<void>
  isLoading?: boolean
}

export function ScheduleModal({
  isOpen,
  schedule,
  onClose,
  onSave,
  isLoading,
}: ScheduleModalProps) {
  const { t } = useTranslation(['schedules', 'common'])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const isEdit = schedule !== null

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title)
      setDescription(schedule.description || '')
    } else {
      setTitle('')
      setDescription('')
    }
  }, [schedule, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit
              ? t('schedules:modal.editTitle')
              : t('schedules:modal.createTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="schedule-title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('schedules:fields.title')}
            </label>
            <input
              id="schedule-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('schedules:fields.titlePlaceholder')}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="schedule-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('schedules:fields.description')}
            </label>
            <textarea
              id="schedule-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('schedules:fields.descriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {t('common:buttons.cancel')}
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEdit
                ? t('common:buttons.save')
                : t('schedules:actions.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
