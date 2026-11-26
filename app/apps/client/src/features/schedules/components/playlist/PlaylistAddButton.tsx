import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Tooltip } from '~/ui/tooltip/Tooltip'
import {
  PlaylistAddPlacement,
  type PlaylistPosition,
} from './PlaylistAddPlacement'
import { useLiveScheduleItemId } from '../../hooks/useLiveScheduleItemId'
import type { Schedule } from '../../types'
import {
  ScheduleItemEditors,
  type ScheduleItemEditorsHandle,
} from '../ScheduleItemEditors'

interface PlaylistAddButtonProps {
  /** Every presentation, in the playlist's order. */
  schedules: Schedule[]
  /** Where items go unless the operator picks another: the one on screen. */
  defaultScheduleId: number
  /** Something was added to `scheduleId`. */
  onAdded: (scheduleId: number) => void
}

/**
 * The control room's Add: the presentations' own add menu (songs, Bible
 * verses, music, gallery videos, another presentation's items, …), adding
 * right after the step on the screens, or at the end.
 */
export function PlaylistAddButton({
  schedules,
  defaultScheduleId,
  onAdded,
}: PlaylistAddButtonProps) {
  const { t } = useTranslation(['schedules', 'common'])
  const editorsRef = useRef<ScheduleItemEditorsHandle>(null)
  const [scheduleId, setScheduleId] = useState(defaultScheduleId)
  const [position, setPosition] = useState<PlaylistPosition>('afterLive')
  const liveItemId = useLiveScheduleItemId(scheduleId)
  const afterItemId =
    position === 'afterLive' && liveItemId !== null ? liveItemId : undefined

  const open = () => {
    setScheduleId(defaultScheduleId)
    setPosition('afterLive')
    editorsRef.current?.addItem()
  }

  return (
    <>
      <Tooltip content={t('schedules:playlist.addHint')} position="bottom">
        <button
          type="button"
          onClick={open}
          data-testid="playlist-add"
          aria-label={t('schedules:playlist.addHint')}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-raised px-3 text-sm font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-hover"
        >
          <Plus size={16} strokeWidth={1.5} />
          <span>{t('common:addMenu.button')}</span>
        </button>
      </Tooltip>
      <ScheduleItemEditors
        ref={editorsRef}
        scheduleId={scheduleId}
        afterItemId={afterItemId}
        canAddPresentation
        placement={
          <PlaylistAddPlacement
            schedules={schedules}
            scheduleId={scheduleId}
            onScheduleChange={setScheduleId}
            canAddAfterLive={liveItemId !== null}
            position={position}
            onPositionChange={setPosition}
          />
        }
        onChanged={() => onAdded(scheduleId)}
      />
    </>
  )
}
