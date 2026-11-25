import { Loader2, Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'
import { useRunSchedule, useScheduleAutomation } from '../hooks'

const logger = createLogger('schedules:run')

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
  const { showToast } = useToast()
  const { hasPermission } = usePermissions()
  const { data: automation } = useScheduleAutomation()
  const { run, stop } = useRunSchedule()

  if (!hasPermission('control_room.control')) return null

  const isRunning = automation?.running && automation.scheduleId === scheduleId
  const isPending = run.isPending || stop.isPending

  const handleClick = async () => {
    try {
      if (isRunning) await stop.mutateAsync()
      else await run.mutateAsync(scheduleId)
    } catch (error) {
      logger.error('Run/Stop failed:', error)
      showToast(t('automation.runError'), 'error')
    }
  }

  const label = isRunning ? t('automation.stop') : t('automation.run')
  const Icon = isPending ? Loader2 : isRunning ? Square : Play

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={label}
      title={
        isRunning
          ? t('automation.stopDescription')
          : t('automation.runDescription')
      }
      data-testid="schedule-run-button"
      data-running={isRunning ? 'true' : 'false'}
      className={`flex items-center gap-2 rounded-lg text-sm text-white transition-colors disabled:opacity-50 ${
        compact ? 'p-1.5' : 'px-2 py-1.5 lg:px-3'
      } ${
        isRunning
          ? 'bg-red-600 hover:bg-red-700'
          : 'bg-green-600 hover:bg-green-700'
      }`}
    >
      <Icon
        className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`}
        fill={isRunning && !isPending ? 'currentColor' : 'none'}
      />
      {!compact && <span className="hidden sm:inline">{label}</span>}
      {isRunning && automation.running && (
        <span
          className="rounded bg-white/20 px-1.5 text-xs tabular-nums"
          data-testid="schedule-run-progress"
        >
          {automation.stepIndex + 1}/{automation.stepCount}
        </span>
      )}
    </button>
  )
}
