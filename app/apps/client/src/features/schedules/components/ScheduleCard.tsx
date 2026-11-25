import {
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  ListMusic,
  Loader2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SyncChangeKind } from '~/features/sync'
import { SyncUpdateBadge } from '~/features/sync'
import { ActionMenu } from '~/ui/menu'
import { HighlightedText } from '~/ui/search'

interface ScheduleCardProps {
  schedule: {
    id: number
    title: string
    description: string | null
    itemCount: number
    /** Unix seconds. */
    createdAt?: number
    matchedContent?: string
  }
  onClick: () => void
  onSaveClick?: (scheduleId: number) => void
  isSaving?: boolean
  /** Unseen sync change applied from another device (renders a badge). */
  syncChangeKind?: SyncChangeKind
}

export function ScheduleCard({
  schedule,
  onClick,
  onSaveClick,
  isSaving,
  syncChangeKind,
}: ScheduleCardProps) {
  const { t, i18n } = useTranslation('schedules')
  const { t: tCommon } = useTranslation('common')

  // The API sends Unix seconds, like every other timestamp it returns.
  const formatDate = (unixSeconds: number) => {
    return new Date(unixSeconds * 1000).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="w-full flex items-center justify-between p-4 bg-panel border border-line rounded-lg hover:border-line-strong transition-all text-left group cursor-pointer"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="p-2 flex-shrink-0">
          <CalendarDays className="w-5 h-5 text-fg-label" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-medium text-fg truncate">{schedule.title}</h3>
            {syncChangeKind && (
              <span className="flex-shrink-0">
                <SyncUpdateBadge changeKind={syncChangeKind} />
              </span>
            )}
          </div>
          {schedule.description && (
            <p className="text-[13px] text-fg-hint mt-0.5 line-clamp-1">
              {schedule.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <ListMusic className="w-3 h-3 text-fg-hint" strokeWidth={2} />
              <span className="text-xs text-fg-hint">
                {t('itemCount', { count: schedule.itemCount })}
              </span>
            </div>
            {schedule.createdAt && (
              <div
                data-testid="schedule-card-date"
                className="flex items-center gap-1"
              >
                <Clock className="w-3 h-3 text-fg-hint" strokeWidth={2} />
                <span className="text-xs text-fg-hint">
                  {formatDate(schedule.createdAt)}
                </span>
              </div>
            )}
          </div>
          {schedule.matchedContent && (
            <p
              data-testid="schedule-card-snippet"
              className="text-[13px] text-fg-hint mt-1 line-clamp-1"
            >
              <HighlightedText text={schedule.matchedContent} />
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        {onSaveClick && (
          // The menu sits inside the clickable card: its clicks and keys
          // (portal included) must not open the presentation as well.
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <ActionMenu
              items={[
                {
                  id: 'save-to-file',
                  label: t('actions.saveToFile'),
                  description: t('actions.saveToFileDescription'),
                  icon: isSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Download size={18} />
                  ),
                  iconClassName: 'text-fg-label',
                  onSelect: () => onSaveClick(schedule.id),
                  disabled: isSaving,
                  testId: 'schedule-card-save-to-file-action',
                },
              ]}
              label={tCommon('actionsMenu.trigger')}
              testId="schedule-card-actions-menu"
              size="compact"
            />
          </div>
        )}
        <ChevronRight
          className="w-5 h-5 text-fg-hint group-hover:text-fg transition-colors"
          strokeWidth={1.5}
        />
      </div>
    </div>
  )
}
