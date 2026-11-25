import type { ScheduleStep } from './buildScheduleSteps'
import { expandSongSlidesWithChoruses } from '../presentation/expand-song-slides'

/** The words a step shows, without markup: what the room has to read. */
export function stepText({ item, type, index }: ScheduleStep): string {
  switch (type) {
    case 'slide':
      return plainText(
        expandSongSlidesWithChoruses(item.slides)[index]?.content ?? '',
      )
    case 'verse':
      return item.biblePassageVerses[index]?.text ?? ''
    case 'entry':
      return item.verseteTineriEntries[index]?.text ?? ''
    case 'announcement':
      return plainText(item.slideContent ?? '')
    case 'scene':
      return ''
  }
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
}
