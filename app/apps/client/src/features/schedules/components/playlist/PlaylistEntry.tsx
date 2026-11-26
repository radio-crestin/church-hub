import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LiveBadge } from '~/features/presentation'
import { PlaylistItems } from './PlaylistItems'
import { PlaylistRunnerState } from './PlaylistRunnerState'
import type { Schedule } from '../../types'
import { ScheduleRunButton } from '../ScheduleRunButton'

interface PlaylistEntryProps {
  schedule: Schedule
  /** Its content is on the screens right now. */
  isLive: boolean
  /** The runner is running it (Run/Stop shows its step). */
  isRunning: boolean
  isExpanded: boolean
  onToggle: () => void
}

/**
 * One presentation of the control room's playlist: its title, whether it is on
 * the screens or running by itself, Run/Stop, and (opened) its items.
 */
export function PlaylistEntry({
  schedule,
  isLive,
  isRunning,
  isExpanded,
  onToggle,
}: PlaylistEntryProps) {
  const { t } = useTranslation('schedules')
  const Chevron = isExpanded ? ChevronDown : ChevronRight

  return (
    <section
      data-testid="playlist-entry"
      data-schedule-id={schedule.id}
      data-live={isLive ? 'true' : 'false'}
      aria-label={schedule.title}
      className={`rounded-lg ${
        isLive ? 'bg-live-tint ring-1 ring-inset ring-live' : ''
      }`}
    >
      <div className="flex items-start gap-2 p-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            data-testid="playlist-entry-toggle"
            className="flex w-full min-w-0 items-center gap-2 rounded-lg p-1 text-left hover:bg-hover"
          >
            <Chevron
              size={16}
              strokeWidth={1.5}
              className="shrink-0 text-fg-hint"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
              {schedule.title}
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-1.5 pl-7 text-xs tabular-nums text-fg-hint">
            <span>{t('itemCount', { count: schedule.itemCount })}</span>
            {isLive && <LiveBadge isLive />}
            <PlaylistRunnerState
              isRunning={isRunning}
              loops={schedule.automation.loop}
            />
          </div>
        </div>
        <ScheduleRunButton scheduleId={schedule.id} compact />
        <Link
          to="/schedules/$scheduleId"
          params={{ scheduleId: String(schedule.id) }}
          aria-label={t('playlist.open')}
          title={t('playlist.open')}
          className="shrink-0 rounded-lg p-1.5 text-fg-label hover:bg-hover hover:text-fg"
        >
          <ExternalLink size={16} strokeWidth={1.5} />
        </Link>
      </div>
      {isExpanded && (
        <div className="border-t border-line px-1 pb-1">
          <PlaylistItems scheduleId={schedule.id} />
        </div>
      )}
    </section>
  )
}
