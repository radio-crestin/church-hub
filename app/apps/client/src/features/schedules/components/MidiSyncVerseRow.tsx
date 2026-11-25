import { Minus, Play, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SyncVerse } from './MidiSyncNowNext'
import { NUDGE_SECONDS } from '../hooks/useMidiSyncSession'

interface MidiSyncVerseRowProps {
  index: number
  verse: SyncVerse
  time: number
  isCurrent: boolean
  /** The verse the next tap marks. */
  isNext: boolean
  onPlay: () => void
  onNudge: (delta: number) => void
}

const iconButton =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-600 sm:h-9 sm:w-9'

/**
 * One verse and its start in the music: play from just before it (and tap
 * again from there), or nudge its time earlier or later.
 */
export function MidiSyncVerseRow({
  index,
  verse,
  time,
  isCurrent,
  isNext,
  onPlay,
  onNudge,
}: MidiSyncVerseRowProps) {
  const { t } = useTranslation('schedules')
  const fixed = index === 0
  return (
    <li
      data-testid="schedule-midi-sync-slide"
      data-current={isCurrent ? 'true' : undefined}
      data-next={isNext ? 'true' : undefined}
      className={`flex items-center gap-1 rounded-lg px-1 py-0.5 ${
        isCurrent
          ? 'bg-indigo-100 dark:bg-indigo-900/40'
          : isNext
            ? 'ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700'
            : ''
      }`}
    >
      <button
        type="button"
        onClick={onPlay}
        title={t('midi.playFromHere')}
        aria-label={t('midi.playFromHere')}
        data-testid="schedule-midi-sync-play-verse"
        className={iconButton}
      >
        <Play size={16} />
      </button>
      <span className="w-8 shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-200">
        {verse.text.split('\n')[0]}
      </span>
      <button
        type="button"
        onClick={() => onNudge(-NUDGE_SECONDS)}
        disabled={fixed}
        title={t('midi.earlier')}
        aria-label={t('midi.earlier')}
        data-testid="schedule-midi-sync-earlier"
        className={iconButton}
      >
        <Minus size={14} />
      </button>
      <span
        className="w-12 shrink-0 text-center text-sm tabular-nums text-gray-700 dark:text-gray-200"
        data-testid="schedule-midi-sync-time"
      >
        {time.toFixed(1)}
      </span>
      <button
        type="button"
        onClick={() => onNudge(NUDGE_SECONDS)}
        disabled={fixed}
        title={t('midi.later')}
        aria-label={t('midi.later')}
        data-testid="schedule-midi-sync-later"
        className={iconButton}
      >
        <Plus size={14} />
      </button>
    </li>
  )
}
