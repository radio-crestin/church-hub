import { useTranslation } from 'react-i18next'

import { SourceTabs } from '../../media-items/SourceTabs'

export type QueuePosition = 'afterLive' | 'end'

interface QueueAddPlacementProps {
  /** What it adds to: the queue, or the program running. */
  title: string
  /** It has a step on the screens to add after. */
  canAddAfterLive: boolean
  position: QueuePosition
  onPositionChange: (position: QueuePosition) => void
}

/**
 * Where the control room adds: what to, and, while one of its steps is on
 * the screens, right after that item or at the end.
 */
export function QueueAddPlacement({
  title,
  canAddAfterLive,
  position,
  onPositionChange,
}: QueueAddPlacementProps) {
  const { t } = useTranslation('schedules')

  return (
    <div
      data-testid="queue-add-placement"
      className="mb-2 space-y-2 border-b border-line pb-4"
    >
      <p className="truncate text-sm text-fg-label">
        {t('queue.addingTo', { title })}
      </p>
      {canAddAfterLive && (
        <SourceTabs
          testId="queue-add-position"
          value={position}
          onChange={onPositionChange}
          options={[
            { value: 'afterLive', label: t('queue.afterLive') },
            { value: 'end', label: t('queue.atEnd') },
          ]}
        />
      )}
    </div>
  )
}
