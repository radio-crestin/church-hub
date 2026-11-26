import type { SlideDeck } from '~/features/slides-deck/types'
import { deckFirstText } from '~/features/slides-deck/utils/deckFirstText'
import type { ScheduleItem } from '../types'

const MAX_LENGTH = 40

function shorten(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > MAX_LENGTH
    ? `${oneLine.slice(0, MAX_LENGTH - 1)}…`
    : oneLine
}

/** A short name for a program entry, as the operator reads it in the list. */
export function scheduleItemShortTitle(item: ScheduleItem): string {
  if (item.itemType === 'song') return shorten(item.song?.title ?? '')
  if (item.itemType === 'bible_passage') {
    return shorten(item.biblePassageReference ?? '')
  }
  if (item.itemType === 'music') return shorten(item.music?.folderName ?? '')
  if (item.itemType === 'video') return ''
  if (item.itemType === 'schedule') {
    return shorten(item.childSchedule?.title ?? '')
  }
  if (item.itemType === 'slides') {
    return shorten(deckFirstText(item.itemConfig as SlideDeck))
  }
  if (item.slideType === 'versete_tineri' || item.itemType === 'verses') {
    return shorten(item.verseteTineriEntries.map((e) => e.reference).join(', '))
  }
  if (item.slideType === 'scene') return shorten(item.obsSceneName ?? '')
  return shorten(item.slideContent ?? '')
}
