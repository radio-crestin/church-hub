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
        className="relative block h-8 w-full cursor-pointer rounded-md bg-gray-200 dark:bg-gray-700"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-md bg-indigo-200 dark:bg-indigo-900/60"
          style={{ width: percent(position) }}
        />
        {times.map((time, index) => (
          <span
            key={index}
            className={`absolute inset-y-0 flex w-0 items-start justify-center ${
              index === current
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-300'
            }`}
            style={{ left: percent(time) }}
          >
            <span className="h-full w-0.5 bg-current" />
            <span className="absolute -top-0.5 left-1 text-[10px] font-bold">
              {index + 1}
            </span>
          </span>
        ))}
        <span
          className="absolute inset-y-0 w-0.5 bg-red-500"
          style={{ left: percent(position) }}
        />
      </button>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-gray-500 dark:text-gray-400">
        <span data-testid="schedule-midi-sync-clock">
          {formatClock(position)}
        </span>
        <span>{formatClock(durationSeconds)}</span>
      </div>
    </div>
  )
}
