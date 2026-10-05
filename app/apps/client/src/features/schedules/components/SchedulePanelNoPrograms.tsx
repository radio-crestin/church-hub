import { CalendarDays, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { TodayProgramButton } from './TodayProgramButton'
import { useCreateTodayProgram } from '../hooks'

interface SchedulePanelNoProgramsProps {
  /** Opens the "new program" dialog; absent without permission to create. */
  onNewProgram?: () => void
  onCreated: (scheduleId: number) => void
}

/** No program yet: make the first one right here, or today's in one click. */
export function SchedulePanelNoPrograms({
  onNewProgram,
  onCreated,
}: SchedulePanelNoProgramsProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const today = useCreateTodayProgram()

  async function makeToday() {
    const scheduleId = await today.createTodayProgram()
    if (scheduleId === null) {
      showToast(t('messages.error'), 'error')
      return
    }
    showToast(t('messages.saved'), 'success')
    onCreated(scheduleId)
  }

  return (
    <div
      data-testid="schedule-panel-no-programs"
      className="px-4 py-6 text-center"
    >
      <CalendarDays className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('panel.noSchedules')}
      </p>
      {onNewProgram && (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {t('panel.noSchedulesDescription')}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onNewProgram}
              data-testid="schedule-panel-first-program"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              {t('panel.newSchedule')}
            </button>
            <TodayProgramButton
              onClick={makeToday}
              isPending={today.isPending}
              testId="schedule-panel-first-today"
            />
          </div>
        </>
      )}
    </div>
  )
}
