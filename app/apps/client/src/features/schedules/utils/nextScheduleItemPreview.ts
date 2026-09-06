import type { NextItemPreview } from '~/features/presentation'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import i18n from '~/i18n/config'
import type { ScheduleItem } from '../types'

/**
 * The item-type name shown on the stage strip. This is plain (non-React) code,
 * so it reads the shared i18next instance directly instead of a `t` from a
 * hook — the labels reuse the add-menu's names so the program calls an item the
 * same thing wherever the operator meets it.
 */
function typeLabel(key: string): string {
  return i18n.t(key, { ns: 'common' })
}

/**
 * Slide/announcement HTML as plain, line-broken text for the "what comes next"
 * strip on the stage screen. Deliberately its own stripper rather than the
 * songs one: the stage preview wants raw lyrics, without the repetition
 * markers `stripHtmlTags` attaches for the reading lists.
 */
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
 * A peek at the program item that follows `currentItem`, shipped along with the
 * presented content so the stage screen can show the operator what is coming
 * once they reach the last slide/verse of the current one.
 *
 * Returns `undefined` when there is nothing after it, or when the next item has
 * no previewable content (an empty song, an OBS scene).
 */
export function getNextScheduleItemPreview(
  items: ScheduleItem[],
  currentItem: ScheduleItem,
): NextItemPreview | undefined {
  const currentIndex = items.findIndex((i) => i.id === currentItem.id)
  if (currentIndex === -1 || currentIndex >= items.length - 1) {
    return undefined
  }

  const nextItem = items[currentIndex + 1]

  if (nextItem.itemType === 'song') {
    const firstSlide = expandSongSlidesWithChoruses(nextItem.slides)[0]
    if (!firstSlide) return undefined
    return {
      contentType: 'song',
      preview: toPlainPreview(firstSlide.content),
      label: typeLabel('addMenu.song'),
      title: nextItem.song?.title ?? '',
    }
  }

  if (nextItem.itemType === 'bible_passage') {
    const firstVerse = nextItem.biblePassageVerses[0]
    const lastVerse =
      nextItem.biblePassageVerses[nextItem.biblePassageVerses.length - 1]
    if (!firstVerse) return undefined
    // Build reference range (e.g., "Matei 5:1-12" or "Ioan 3:16")
    const startRef = firstVerse.reference
    const endRef = lastVerse?.reference
    const reference =
      startRef === endRef || !endRef
        ? startRef
        : `${startRef} - ${endRef.split(' ').pop()}`
    return {
      contentType: 'bible_passage',
      preview: reference,
      label: typeLabel('addMenu.biblePassage'),
    }
  }

  if (nextItem.itemType === 'slide') {
    if (nextItem.slideType === 'versete_tineri') {
      const entries = nextItem.verseteTineriEntries
      if (entries.length === 0) return undefined
      return {
        contentType: 'versete_tineri',
        preview: entries
          .map((e) => `${e.personName} (${e.reference})`)
          .join(', '),
        label: typeLabel('addMenu.verseteTineri'),
      }
    }
    if (nextItem.slideType === 'announcement') {
      return {
        contentType: 'announcement',
        preview: toPlainPreview(nextItem.slideContent || ''),
        label: typeLabel('addMenu.announcement'),
      }
    }
  }

  return undefined
}
