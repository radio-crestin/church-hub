import { Loader2, Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useScheduleRunToggle } from '../hooks'

interface ScheduleRunButtonProps {
  scheduleId: number
  /** Icon only, for narrow headers such as the presentations panel. */
  compact?: boolean
}

/**
 * Run starts the presentation from its first slide (with autoplay on, the
 * server then moves it on by itself); while it runs, the button stops it and
 * shows how far it got.
 */
export function ScheduleRunButton({
  scheduleId,
  compact = false,
}: ScheduleRunButtonProps) {
  const { t } = useTranslation('schedules')
  const { canRun, isRunning, isPending, automation, label, toggle } =
    useScheduleRunToggle(scheduleId)

  if (!canRun) return null

  const Icon = isPending ? Loader2 : isRunning ? Square : Play

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={label}
      title={
        isRunning
          ? t('automation.stopDescription')
          : t('automation.runDescription')
      }
      data-testid="schedule-run-button"
      data-running={isRunning ? 'true' : 'false'}
      className={`flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        compact ? 'h-[26px] min-w-[26px] px-1.5' : 'h-8 px-2 lg:px-3'
      } ${
        isRunning
          ? 'bg-live-tint text-live ring-1 ring-inset ring-live'
          : compact
            ? 'text-fg-label hover:bg-hover hover:text-fg'
            : 'bg-field text-fg hover:bg-hover'
      }`}
    >
      <Icon
        className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isPending ? 'animate-spin' : ''}`}
        strokeWidth={compact ? 1.75 : 1.5}
        fill={isRunning && !isPending ? 'currentColor' : 'none'}
      />
      {!compact && <span className="hidden sm:inline">{label}</span>}
      {isRunning && automation?.running && (
        <span
          className="text-xs tabular-nums"
          data-testid="schedule-run-progress"
        >
          {automation.stepIndex + 1}/{automation.stepCount}
        </span>
      )}
    </button>
  )
}
