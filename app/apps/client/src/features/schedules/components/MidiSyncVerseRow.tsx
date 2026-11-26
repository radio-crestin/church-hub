import { Minus, Play, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SyncVerse } from './MidiSyncNowNext'
import { NUDGE_SECONDS } from '../hooks/useMidiSyncSession'
import { formatClock } from '../utils/formatClock'

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
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg disabled:opacity-30 sm:h-9 sm:w-9'

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
        isCurrent ? 'bg-selected' : isNext ? 'ring-1 ring-inset ring-focus' : ''
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
        <Play size={16} strokeWidth={1.5} />
      </button>
      <span className="w-8 shrink-0 text-xs font-medium tabular-nums text-fg-hint">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-fg-body">
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
        <Minus size={14} strokeWidth={1.75} />
      </button>
      <span
        className="w-14 shrink-0 text-center text-[13px] tabular-nums text-fg-body"
        data-testid="schedule-midi-sync-time"
      >
        {formatClock(time, true)}
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
        <Plus size={14} strokeWidth={1.75} />
      </button>
    </li>
  )
}
