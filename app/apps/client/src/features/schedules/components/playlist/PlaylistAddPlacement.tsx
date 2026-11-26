import { useTranslation } from 'react-i18next'

import { NativeSelect } from '~/ui/select'
import { SourceTabs } from '../../media-items/SourceTabs'
import type { Schedule } from '../../types'

export type PlaylistPosition = 'afterLive' | 'end'

interface PlaylistAddPlacementProps {
  schedules: Schedule[]
  scheduleId: number
  onScheduleChange: (scheduleId: number) => void
  /** The chosen presentation has a step on the screens to add after. */
  canAddAfterLive: boolean
  position: PlaylistPosition
  onPositionChange: (position: PlaylistPosition) => void
}

/**
 * Where the control room adds: which presentation, and, when it is the one
 * on the screens, right after its item on screen or at its end.
 */
export function PlaylistAddPlacement({
  schedules,
  scheduleId,
  onScheduleChange,
  canAddAfterLive,
  position,
  onPositionChange,
}: PlaylistAddPlacementProps) {
  const { t } = useTranslation('schedules')

  return (
    <div
      data-testid="playlist-add-placement"
      className="mb-2 space-y-2 border-b border-line pb-4"
    >
      <label
        htmlFor="playlist-add-target"
        className="block text-xs text-fg-hint"
      >
        {t('playlist.addTo')}
      </label>
      <NativeSelect
        id="playlist-add-target"
        testId="playlist-add-target"
        value={String(scheduleId)}
        options={schedules.map((s) => ({
          value: String(s.id),
          label: s.title,
        }))}
        onChange={(value) => onScheduleChange(Number(value))}
      />
      {canAddAfterLive && (
        <SourceTabs
          testId="playlist-add-position"
          value={position}
          onChange={onPositionChange}
          options={[
            { value: 'afterLive', label: t('playlist.afterLive') },
            { value: 'end', label: t('playlist.atEnd') },
          ]}
        />
      )}
    </div>
  )
}
