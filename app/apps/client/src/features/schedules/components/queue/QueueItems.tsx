import { arrayMove } from '@dnd-kit/sortable'

import {
  useRemoveItemFromSchedule,
  useReorderScheduleItems,
  useScheduleFlatNavigation,
} from '../../hooks'
import type { ScheduleItem } from '../../types'
import { ScheduleItemsPanel } from '../ScheduleItemsPanel'

interface QueueItemsProps {
  scheduleId: number
  /**
   * The items can be edited, moved and removed (the queue); without it they
   * are only followed and presented (a running program).
   */
  onEditItem?: (item: ScheduleItem) => void
}

/**
 * A presentation's items as the presentation page lists them (songs with their
 * slides, passages with their verses, presentations inside it as groups), the
 * live step lit; a click puts that step on the screens.
 */
export function QueueItems({ scheduleId, onEditItem }: QueueItemsProps) {
  const nav = useScheduleFlatNavigation({ scheduleId })
  const reorder = useReorderScheduleItems()
  const remove = useRemoveItemFromSchedule()
  const editable = !!onEditItem

  return (
    <ScheduleItemsPanel
      scheduleId={scheduleId}
      items={nav.items}
      isLoading={nav.isLoading}
      onSlideClick={nav.presentSongSlide}
      onVerseClick={nav.presentPassageVerse}
      onEntryClick={nav.presentVerseteEntry}
      onAnnouncementClick={nav.presentAnnouncement}
      onSceneClick={nav.presentScene}
      onVideoClick={nav.presentVideo}
      onDeckStepClick={nav.presentDeckStep}
      onEditItem={onEditItem}
      onReorder={
        editable
          ? (from, to) =>
              reorder.mutate({
                scheduleId,
                input: {
                  itemIds: arrayMove(nav.items, from, to).map((i) => i.id),
                },
              })
          : undefined
      }
      onDeleteItem={
        editable
          ? (item) => remove.mutate({ scheduleId, itemId: item.id })
          : undefined
      }
      readOnly={!editable}
      quietPast
    />
  )
}
