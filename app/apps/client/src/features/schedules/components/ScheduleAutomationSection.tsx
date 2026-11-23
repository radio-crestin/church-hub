import { ChevronDown, Timer, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ScheduleAutomationSettings } from './ScheduleAutomationSettings'
import { useScheduleAutomation } from '../hooks'
import type { Schedule } from '../types'
import { describeAutomation } from '../utils/describeAutomation'
import { isAutomationOn } from '../utils/isAutomationOn'

const COLLAPSED_KEY = 'schedule-automation:collapsed'

interface ScheduleAutomationSectionProps {
  schedule: Pick<Schedule, 'id' | 'title' | 'description' | 'automation'>
  /** Hides the section; offered only while nothing in it is on. */
  onClose: () => void
}

/**
 * The presentation's automation, in the page rather than a dialog: shown while
 * any of it is on (or the operator opened it from the menu). While it is on, it
 * folds down to one line saying what will happen; while nothing is on, it can
 * be closed.
 */
export function ScheduleAutomationSection({
  schedule,
  onClose,
}: ScheduleAutomationSectionProps) {
  const { t } = useTranslation('schedules')
  const { data: runner } = useScheduleAutomation()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === 'true',
  )

  const running = runner?.running && runner.scheduleId === schedule.id
  const on = isAutomationOn(schedule.automation) || running
  // Nothing on yet: the operator opened it to set something, so show it all.
  const folded = on && collapsed

  const toggleCollapsed = () => {
    localStorage.setItem(COLLAPSED_KEY, String(!collapsed))
    setCollapsed(!collapsed)
  }

  const summary = describeAutomation(schedule.automation, t)

  return (
    <section
      aria-label={t('automation.title')}
      data-testid="schedule-automation-section"
      data-collapsed={folded ? 'true' : 'false'}
      className="mb-3 flex-shrink-0 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 dark:border-indigo-900/60 dark:bg-indigo-950/30 lg:mb-4"
    >
      <div className="flex items-center gap-2 py-2">
        <Timer
          size={16}
          className="shrink-0 text-indigo-600 dark:text-indigo-400"
        />
        <h2 className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
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
        <p
          className="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-400"
          data-testid="schedule-automation-summary"
        >
          {summary.length > 0
            ? summary.join(' · ')
            : t('automation.description')}
        </p>
        {on ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!folded}
            aria-label={
              folded ? t('automation.expand') : t('automation.collapse')
            }
            title={folded ? t('automation.expand') : t('automation.collapse')}
            data-testid="schedule-automation-toggle"
            className="shrink-0 rounded p-1 text-gray-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
          >
            <ChevronDown
              size={18}
              className={`transition-transform ${folded ? '' : 'rotate-180'}`}
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('automation.hide')}
            title={t('automation.hide')}
            data-testid="schedule-automation-close"
            className="shrink-0 rounded p-1 text-gray-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
          >
            <X size={18} />
          </button>
        )}
      </div>
      {!folded && (
        <div className="border-t border-indigo-100 dark:border-indigo-900/60">
          <ScheduleAutomationSettings schedule={schedule} />
        </div>
      )}
    </section>
  )
}
