import { Loader2, Play, Square } from 'lucide-react'

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
  const {
    allowed,
    isRunning,
    isPending,
    progress,
    label,
    description,
    toggle,
  } = useScheduleRunToggle(scheduleId)

  if (!allowed) return null

  const Icon = isPending ? Loader2 : isRunning ? Square : Play

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={label}
      title={description}
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
      {progress && (
        <span
          className="rounded bg-white/20 px-1.5 text-xs tabular-nums"
          data-testid="schedule-run-progress"
        >
          {progress}
        </span>
      )}
    </button>
  )
}
