import { useTranslation } from 'react-i18next'

import { formatClock } from '../utils/formatClock'

interface MidiSyncTimelineProps {
  times: number[]
  position: number
  durationSeconds: number
  current: number
  onSeek: (seconds: number) => void
}

/**
 * The song as a bar: a numbered tick where each verse starts, the playhead,
 * and the time. Clicking the bar jumps there, like a player's progress bar.
 */
export function MidiSyncTimeline({
  times,
  position,
  durationSeconds,
  current,
  onSeek,
}: MidiSyncTimelineProps) {
  const { t } = useTranslation('schedules')
  const percent = (seconds: number) =>
    `${Math.min(100, (seconds / Math.max(durationSeconds, 0.1)) * 100)}%`

  return (
    <div>
      <button
        type="button"
        aria-label={t('midi.seek')}
        data-testid="schedule-midi-sync-timeline"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          onSeek(((e.clientX - rect.left) / rect.width) * durationSeconds)
        }}
        className="relative block h-8 w-full cursor-pointer rounded-lg bg-field focus:outline-none focus-visible:ring-1 focus-visible:ring-focus"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-lg bg-selected"
          style={{ width: percent(position) }}
        />
        {times.map((time, index) => (
          <span
            key={index}
            className={`absolute inset-y-0 flex w-0 items-start justify-center ${
              index === current ? 'text-fg' : 'text-fg-hint'
            }`}
            style={{ left: percent(time) }}
          >
            <span className="h-full w-0.5 bg-current" />
            <span className="absolute -top-0.5 left-1 text-xs font-semibold tabular-nums">
              {index + 1}
            </span>
          </span>
        ))}
        <span
          className="absolute inset-y-0 w-0.5 bg-fg"
          style={{ left: percent(position) }}
        />
      </button>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-fg-hint">
        <span data-testid="schedule-midi-sync-clock">
          {formatClock(position)}
        </span>
        <span>{formatClock(durationSeconds)}</span>
      </div>
    </div>
  )
}
