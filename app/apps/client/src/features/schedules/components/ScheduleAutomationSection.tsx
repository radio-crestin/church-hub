import { Timer, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ScheduleAutomationSettings } from './ScheduleAutomationSettings'
import { useScheduleAutomation } from '../hooks'
import type { Schedule } from '../types'
import { describeAutomation } from '../utils/describeAutomation'
import { isAutomationOn } from '../utils/isAutomationOn'

interface ScheduleAutomationSectionProps {
  schedule: Pick<Schedule, 'id' | 'title' | 'description' | 'automation'>
  /** Hides the panel; offered only while nothing in it is on. */
  onClose: () => void
}

/**
 * The presentation's automation as a panel of the page, beside the preview:
 * what will happen in one line, then the settings. Shown while any of it is on
 * (or the operator opened it from the menu); while nothing is on, it can be
 * closed.
 */
export function ScheduleAutomationSection({
  schedule,
  onClose,
}: ScheduleAutomationSectionProps) {
  const { t } = useTranslation('schedules')
  const { data: runner } = useScheduleAutomation()

  const running = runner?.running && runner.scheduleId === schedule.id
  const on = isAutomationOn(schedule.automation) || running
  const summary = describeAutomation(schedule.automation, t)

  return (
    <section
      aria-label={t('automation.title')}
      data-testid="schedule-automation-section"
      className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
        <Timer
          size={16}
          className="shrink-0 text-indigo-600 dark:text-indigo-400"
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
          {t('automation.title')}
        </h2>
        {running && runner?.running && (
          <span
            className="shrink-0 rounded bg-green-600 px-1.5 text-xs text-white tabular-nums"
            data-testid="schedule-automation-running"
          >
            {t('automation.runningStep', {
              step: runner.stepIndex + 1,
              count: runner.stepCount,
            })}
          </span>
        )}
        {!on && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('automation.hide')}
            title={t('automation.hide')}
            data-testid="schedule-automation-close"
            className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <p
          className="pt-2 text-xs text-gray-600 dark:text-gray-400"
          data-testid="schedule-automation-summary"
        >
          {summary.length > 0
            ? summary.join(' · ')
            : t('automation.description')}
        </p>
        <ScheduleAutomationSettings schedule={schedule} />
      </div>
    </section>
  )
}
