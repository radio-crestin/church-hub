import { ScheduleAnnouncementSlideRow } from './ScheduleAnnouncementSlideRow'
import { ScheduleBiblePassageVerseList } from './ScheduleBiblePassageVerseList'
import { ScheduleSceneSlideRow } from './ScheduleSceneSlideRow'
import { ScheduleSongSlideList } from './ScheduleSongSlideList'
import { ScheduleVerseteTineriEntryList } from './ScheduleVerseteTineriEntryList'
import type { ScheduleItem } from '../types'
import type { PresentedScheduleInfo } from '../utils/presentedScheduleInfo'

interface ScheduleItemSubItemsProps {
  item: ScheduleItem
  presentedInfo: PresentedScheduleInfo | null
  /** Where this item starts in the program's flat run. */
  itemStartFlatIndex: number
  /** Attached to the presented row so the list can scroll it into view. */
  highlightedRef?: React.RefObject<HTMLButtonElement | null>
  onSlideClick: (item: ScheduleItem, slideIndex: number) => void
  onVerseClick: (item: ScheduleItem, verseIndex: number) => void
  onEntryClick: (item: ScheduleItem, entryIndex: number) => void
  onAnnouncementClick: (item: ScheduleItem) => void
  onSceneClick?: (item: ScheduleItem) => void
}

/**
 * The presentable steps hiding inside one program item, whatever kind it is.
 * One place decides which sub-list a kind gets, so the program page and the
 * Programe panel can never drift apart.
 */
export function ScheduleItemSubItems({
  item,
  presentedInfo,
  itemStartFlatIndex,
  highlightedRef,
  onSlideClick,
  onVerseClick,
  onEntryClick,
  onAnnouncementClick,
  onSceneClick,
}: ScheduleItemSubItemsProps) {
  if (item.itemType === 'song') {
    return (
      <ScheduleSongSlideList
        item={item}
        presentedInfo={presentedInfo}
        itemStartFlatIndex={itemStartFlatIndex}
        highlightedRef={highlightedRef}
        onSlideClick={onSlideClick}
      />
    )
  }

  if (item.itemType === 'bible_passage') {
    return (
      <ScheduleBiblePassageVerseList
        item={item}
        presentedInfo={presentedInfo}
        itemStartFlatIndex={itemStartFlatIndex}
        highlightedRef={highlightedRef}
        onVerseClick={onVerseClick}
      />
    )
  }

  if (item.itemType === 'slide' && item.slideType === 'versete_tineri') {
    return (
      <ScheduleVerseteTineriEntryList
        item={item}
        presentedInfo={presentedInfo}
        itemStartFlatIndex={itemStartFlatIndex}
        highlightedRef={highlightedRef}
        onEntryClick={onEntryClick}
      />
    )
  }

  if (item.itemType === 'slide' && item.slideType === 'scene') {
    return (
      <ScheduleSceneSlideRow
        item={item}
        presentedInfo={presentedInfo}
        itemStartFlatIndex={itemStartFlatIndex}
        highlightedRef={highlightedRef}
        onSceneClick={onSceneClick}
      />
    )
  }

  if (item.itemType === 'slide' && item.slideType === 'announcement') {
    return (
      <ScheduleAnnouncementSlideRow
        item={item}
        presentedInfo={presentedInfo}
        itemStartFlatIndex={itemStartFlatIndex}
        highlightedRef={highlightedRef}
        onAnnouncementClick={onAnnouncementClick}
      />
    )
  }

  return null
}
