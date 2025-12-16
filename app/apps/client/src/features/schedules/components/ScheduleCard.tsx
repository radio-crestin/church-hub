import { CalendarDays, ChevronRight, Clock, ListMusic } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ScheduleCardProps {
  schedule: {
    id: number
    title: string
    description: string | null
    itemCount: number
    createdAt?: number
    matchedContent?: string
  }
  onClick: () => void
}

export function ScheduleCard({ schedule, onClick }: ScheduleCardProps) {
  const { t, i18n } = useTranslation('schedules')

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all text-left group"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex-shrink-0">
          <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {schedule.title}
          </h3>
          {schedule.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
              {schedule.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <ListMusic className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('itemCount', { count: schedule.itemCount })}
              </span>
            </div>
            {schedule.createdAt && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(schedule.createdAt)}
                </span>
              </div>
            )}
          </div>
          {schedule.matchedContent && (
            <p
              className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1"
              dangerouslySetInnerHTML={{ __html: schedule.matchedContent }}
            />
          )}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 ml-2" />
    </button>
  )
}
