import { Copy, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Schedule } from '../service/types'

interface ScheduleListItemProps {
  schedule: Schedule
  onEdit: (schedule: Schedule) => void
  onDelete: (id: number) => void
  onDuplicate: (id: number) => void
}

export function ScheduleListItem({
  schedule,
  onEdit,
  onDelete,
  onDuplicate,
}: ScheduleListItemProps) {
  const { t, i18n } = useTranslation('schedules')
  const [showMenu, setShowMenu] = useState(false)

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div
      className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors cursor-pointer group"
      onClick={() => onEdit(schedule)}
    >
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 dark:text-white truncate">
          {schedule.title}
        </h3>
        {schedule.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
            {schedule.description}
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {t('list.updatedAt', { date: formatDate(schedule.updated_at) })}
        </p>
      </div>

      <div className="relative ml-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
              }}
            />
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  onEdit(schedule)
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Pencil className="w-4 h-4" />
                {t('actions.edit')}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  onDuplicate(schedule.id)
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Copy className="w-4 h-4" />
                {t('actions.duplicate')}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  onDelete(schedule.id)
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                {t('actions.delete')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
