import { ListVideo, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePresentationState } from '~/features/presentation'
import { usePermissions } from '~/provider/permissions-provider'
import { EmptyState } from '~/ui/page'
import { PlaylistAddButton } from './PlaylistAddButton'
import { PlaylistEntry } from './PlaylistEntry'
import { useScheduleAutomation, useSchedules } from '../../hooks'
import { playlistOrder } from '../../utils/playlistOrder'
import { derivePresentedScheduleInfo } from '../../utils/presentedScheduleInfo'

/**
 * The control room's playlist: the presentations with their items, the one on
 * the screens first, opened and marked LIVE, so the operator follows it slide
 * by slide; then those that run by themselves, then the latest ones. Add puts
 * a song, verses, music, a video… into one of them, after the step on screen.
 */
export function PresentationPlaylist() {
  const { t } = useTranslation('schedules')
  const { data: schedules = [], isLoading } = useSchedules()
  const { data: presentationState } = usePresentationState()
  const { data: automation } = useScheduleAutomation()
  const canEdit = usePermissions().hasPermission('programs.edit')
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const liveId =
    derivePresentedScheduleInfo(presentationState?.temporaryContent)
      ?.scheduleId ?? null
  const isOnScreens = !(presentationState?.isHidden ?? true)
  const runner = automation?.running ? automation : null

  // The presentation that goes on the screens opens by itself.
  useEffect(() => {
    if (liveId != null) setExpanded((prev) => new Set(prev).add(liveId))
  }, [liveId])

  const expand = (id: number) => setExpanded((prev) => new Set(prev).add(id))
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-fg-hint" />
      </div>
    )
  }

  if (schedules.length === 0) {
    return <EmptyState icon={ListVideo} title={t('playlist.empty')} />
  }

  const { shown, hidden } = playlistOrder(schedules, [
    liveId,
    runner?.scheduleId,
  ])
  const visible = showAll ? [...shown, ...hidden] : shown

  return (
    <div className="flex flex-col gap-2" data-testid="presentation-playlist">
      <div className="flex items-center justify-between gap-2 pl-2">
        <h2 className="text-sm font-medium text-fg">{t('playlist.title')}</h2>
        {canEdit && (
          <PlaylistAddButton
            schedules={[...shown, ...hidden]}
            defaultScheduleId={shown[0].id}
            onAdded={expand}
          />
        )}
      </div>
      {visible.map((schedule) => (
        <PlaylistEntry
          key={schedule.id}
          schedule={schedule}
          isLive={isOnScreens && schedule.id === liveId}
          isRunning={runner?.scheduleId === schedule.id}
          isExpanded={expanded.has(schedule.id)}
          onToggle={() => toggle(schedule.id)}
        />
      ))}
      {hidden.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          data-testid="playlist-show-all"
          className="rounded-lg py-2 text-sm font-medium text-fg-label tabular-nums hover:bg-hover hover:text-fg"
        >
          {showAll
            ? t('playlist.showFewer')
            : t('playlist.showAll', { count: hidden.length })}
        </button>
      )}
    </div>
  )
}
