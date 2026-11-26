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
      {progress && (
        <span
          className="text-xs tabular-nums"
          data-testid="schedule-run-progress"
        >
          {progress}
        </span>
      )}
    </button>
  )
}
