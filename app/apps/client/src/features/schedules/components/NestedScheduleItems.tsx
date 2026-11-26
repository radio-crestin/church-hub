import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { ScheduleItemSubItems } from './ScheduleItemSubItems'
import { ScheduleItemTypeIcon } from './ScheduleItemTypeIcon'
import { useMediaItemText } from '../media-items/hooks/useMediaItemText'
import type { ScheduleItem } from '../types'
import { countScheduleItemSteps } from '../utils/scheduleFlatItems'

type SubItemsProps = ComponentProps<typeof ScheduleItemSubItems>

/**
 * A presentation inside a presentation, opened: each of its items with its
 * steps, numbered on from where it starts in the running order, so its live
 * step lights up like any other. Nested ones nest the same way.
 */
export function NestedScheduleItems(props: SubItemsProps) {
  const items = props.item.childSchedule?.items ?? []
  let start = props.itemStartFlatIndex

  return (
    <div
      data-testid="nested-schedule-items"
      className="flex flex-col gap-2 border-l border-line pl-3"
    >
      {items.map((child) => {
        const childStart = start
        start += countScheduleItemSteps(child)
        return (
          <div key={child.id} data-testid="nested-schedule-item">
            <NestedItemTitle item={child} />
            <ScheduleItemSubItems
              {...props}
              item={child}
              itemStartFlatIndex={childStart}
            />
          </div>
        )
      })}
    </div>
  )
}

/** The item's name, as its row in the presentation's own list reads. */
function NestedItemTitle({ item }: { item: ScheduleItem }) {
  const { t } = useTranslation('schedules')
  const mediaText = useMediaItemText(item)
  const title =
    mediaText?.title ??
    (item.itemType === 'song'
      ? item.song?.title
      : item.slideType === 'scene'
        ? item.obsSceneName
        : item.slideType === 'versete_tineri'
          ? t('presenter.verseteTineri')
          : item.itemType === 'bible_passage'
            ? item.biblePassageReference
            : t('presenter.announcement'))
  return (
    <div className="flex min-w-0 items-center gap-2 py-1 text-xs font-medium text-fg-label">
      <ScheduleItemTypeIcon item={item} size="sm" />
      <span className="truncate">{title}</span>
    </div>
  )
}
