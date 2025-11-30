import { useNavigate } from '@tanstack/react-router'
import { Calendar, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { ScheduleListItem } from './schedule-list-item'
import { ScheduleModal } from './schedule-modal'
import {
  useCreateSchedule,
  useDeleteSchedule,
  useDuplicateSchedule,
  useSchedules,
} from '../hooks/use-schedules'
import type {
  CreateScheduleInput,
  Schedule,
  UpdateScheduleInput,
} from '../service/types'

interface ScheduleListProps {
  className?: string
}

export function ScheduleList({ className = '' }: ScheduleListProps) {
  const { t } = useTranslation(['schedules', 'common'])
  const { showToast } = useToast()
  const navigate = useNavigate()

  const { data: schedules = [], isLoading } = useSchedules()
  const createMutation = useCreateSchedule()
  const deleteMutation = useDeleteSchedule()
  const duplicateMutation = useDuplicateSchedule()

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) return schedules

    const query = searchQuery.toLowerCase()
    return schedules.filter(
      (schedule) =>
        schedule.title.toLowerCase().includes(query) ||
        schedule.description?.toLowerCase().includes(query),
    )
  }, [schedules, searchQuery])

  const handleCreate = () => {
    setShowModal(true)
  }

  const handleEdit = (schedule: Schedule) => {
    navigate({
      to: '/presentation/$scheduleId',
      params: { scheduleId: String(schedule.id) },
    })
  }

  const handleSave = async (
    input: CreateScheduleInput | UpdateScheduleInput,
  ) => {
    const result = await createMutation.mutateAsync(
      input as CreateScheduleInput,
    )
    if (result.success && result.id) {
      showToast(t('schedules:messages.created'), 'success')
      setShowModal(false)
      navigate({
        to: '/presentation/$scheduleId',
        params: { scheduleId: String(result.id) },
      })
    } else {
      showToast(t('schedules:messages.error'), 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    const result = await deleteMutation.mutateAsync(deleteId)
    if (result.success) {
      showToast(t('schedules:messages.deleted'), 'success')
    } else {
      showToast(t('schedules:messages.error'), 'error')
    }
    setDeleteId(null)
  }

  const handleDuplicate = async (id: number) => {
    const result = await duplicateMutation.mutateAsync(id)
    if (result.success) {
      showToast(t('schedules:messages.duplicated'), 'success')
    } else {
      showToast(t('schedules:messages.error'), 'error')
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('schedules:title')}
        </h1>
        <button
          type="button"
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('schedules:actions.create')}
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('schedules:search.placeholder')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery
                ? t('schedules:search.noResults')
                : t('schedules:list.empty')}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleCreate}
                className="mt-4 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                {t('schedules:list.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSchedules.map((schedule) => (
              <ScheduleListItem
                key={schedule.id}
                schedule={schedule}
                onEdit={handleEdit}
                onDelete={(id) => setDeleteId(id)}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <ScheduleModal
        isOpen={showModal}
        schedule={null}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        isLoading={createMutation.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        title={t('schedules:modal.deleteTitle')}
        message={t('schedules:modal.deleteMessage')}
        confirmLabel={t('schedules:actions.delete')}
        cancelLabel={t('common:buttons.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />
    </div>
  )
}
