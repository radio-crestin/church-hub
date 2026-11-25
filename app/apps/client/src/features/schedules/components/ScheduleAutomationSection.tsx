import { Timer, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ScheduleAutomationSettings } from './ScheduleAutomationSettings'
import { useScheduleAutomation } from '../hooks'
import type { Schedule, ScheduleItem } from '../types'
import { describeAutomation } from '../utils/describeAutomation'
import { formatDuration } from '../utils/formatDuration'
import { isAutomationOn } from '../utils/isAutomationOn'
import { itemStepSeconds } from '../utils/itemStepSeconds'

interface ScheduleAutomationSectionProps {
  schedule: Pick<Schedule, 'id' | 'title' | 'description' | 'automation'>
  /** Its items, for how long one pass through them takes. */
  items: ScheduleItem[]
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
  items,
  onClose,
}: ScheduleAutomationSectionProps) {
  const { t } = useTranslation('schedules')
  const { data: runner } = useScheduleAutomation()

  const running = runner?.running && runner.scheduleId === schedule.id
  const on = isAutomationOn(schedule.automation) || running
  const summary = describeAutomation(schedule.automation, t)
  const { autoplaySeconds, autoplayByText } = schedule.automation
  if (autoplaySeconds != null) {
    // One pass through the presentation, as PowerPoint's slide timings add up.
    const total = items
      .flatMap((item) =>
        itemStepSeconds(item, { autoplaySeconds, autoplayByText }),
      )
      .reduce((sum, seconds) => sum + seconds, 0)
    summary.push(
      t('automation.summary.duration', { duration: formatDuration(total) }),
    )
  }

  return (
    <section
      aria-label={t('automation.title')}
      data-testid="schedule-automation-section"
      className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-panel"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Timer size={16} className="shrink-0 text-fg-label" strokeWidth={1.5} />
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg">
          {t('automation.title')}
        </h2>
        {running && runner?.running && (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-fg-label tabular-nums"
            data-testid="schedule-automation-running"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
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
            className="shrink-0 rounded p-1 text-fg-hint hover:bg-hover"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <p
          className="pt-2 text-xs text-fg-label"
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
