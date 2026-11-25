import { expandSongSlidesWithChoruses } from '../presentation/expand-song-slides'
import type { NextItemPreview } from '../presentation/types'
import type { ScheduleItem } from '../schedules/types'

function toPlainPreview(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * A peek at the item after `item`, for the stage screen's "what comes next"
 * strip. Mirrors the client's `getNextScheduleItemPreview` (without the label,
 * which nothing displays).
 */
export function nextItemPreview(
  items: ScheduleItem[],
  item: ScheduleItem,
): NextItemPreview | undefined {
  const next = items[items.findIndex((i) => i.id === item.id) + 1]
  if (!next || next.id === item.id) return undefined

  if (next.itemType === 'song') {
    const firstSlide = expandSongSlidesWithChoruses(next.slides)[0]
    if (!firstSlide) return undefined
    return {
      contentType: 'song',
      preview: toPlainPreview(firstSlide.content),
      title: next.song?.title ?? '',
    }
  }
  if (next.itemType === 'bible_passage') {
    const first = next.biblePassageVerses[0]
    const last = next.biblePassageVerses.at(-1)
    if (!first || !last) return undefined
    const preview =
      first.reference === last.reference
        ? first.reference
        : `${first.reference} - ${last.reference.split(' ').pop()}`
    return { contentType: 'bible_passage', preview }
  }
  if (next.slideType === 'versete_tineri' || next.itemType === 'verses') {
    if (next.verseteTineriEntries.length === 0) return undefined
    return {
      contentType: 'versete_tineri',
      preview: next.verseteTineriEntries
        .map((e) =>
          e.personName ? `${e.personName} (${e.reference})` : e.reference,
        )
        .join(', '),
    }
  }
  if (next.slideType === 'announcement') {
    return {
      contentType: 'announcement',
      preview: toPlainPreview(next.slideContent || ''),
    }
  }
  return undefined
}
