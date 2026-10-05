import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SchedulePanelNoProgramsProps {
  /** Whether this user may make programs (the header's green +). */
  canCreate: boolean
}

/** No program yet: points to the header's green + instead of another page. */
export function SchedulePanelNoPrograms({
  canCreate,
}: SchedulePanelNoProgramsProps) {
  const { t } = useTranslation('schedules')

  return (
    <div
      data-testid="schedule-panel-no-programs"
      className="px-4 py-6 text-center"
    >
      <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('panel.noSchedules')}
      </p>
      {canCreate && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {t('panel.noSchedulesDescription')}
        </p>
      )}
    </div>
  )
}
