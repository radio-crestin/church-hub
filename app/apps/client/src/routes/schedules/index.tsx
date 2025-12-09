import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ScheduleList } from '~/features/schedules/components'

export const Route = createFileRoute('/schedules/')({
  component: SchedulesPage,
})

function SchedulesPage() {
  const { t } = useTranslation('schedules')
  const navigate = useNavigate()

  const handleScheduleClick = (scheduleId: number) => {
    navigate({
      to: '/schedules/$scheduleId',
      params: { scheduleId: String(scheduleId) },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <button
          type="button"
          onClick={() =>
            navigate({
              to: '/schedules/$scheduleId',
              params: { scheduleId: 'new' },
            })
          }
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('actions.create')}
        </button>
      </div>

      <ScheduleList onScheduleClick={handleScheduleClick} />
    </div>
  )
}
