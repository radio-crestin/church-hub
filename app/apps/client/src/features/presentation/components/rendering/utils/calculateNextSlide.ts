import type { BibleVerse } from '../../../../bible/types'
import type { QueueItem, VerseteTineriEntry } from '../../../../queue/types'
import type { SongSlide } from '../../../../songs/types'
import type { ContentType, PresentationState } from '../../../types'
import type { NextSlideData, VerseteTineriSummaryEntry } from '../types'

const MAX_VERSETE_TINERI_PREVIEW_ENTRIES = 5

interface CalculateNextSlideParams {
  queueItems: QueueItem[]
  presentationState: PresentationState
  /** Optional: Next Bible verse from scripture (used when at end of Bible content with no next queue item) */
  nextBibleVerse?: BibleVerse | null
}

/**
 * Strips HTML tags from content while preserving line breaks
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n') // Replace <br> tags with newlines
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n') // Replace </p><p> with newline
    .replace(/<\/(p|div|h[1-6])>/gi, '\n') // Closing block tags to newlines
    .replace(/<[^>]*>/g, '') // Remove all remaining HTML tags
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .trim()
}

/**
 * Formats a song slide preview
 */
function formatSongPreview(content: string): string {
  return stripHtml(content)
}

/**
 * Strips translation abbreviation from reference (e.g., "John 3:16 - RCCV" -> "John 3:16")
 */
function stripTranslation(reference: string): string {
  return reference.replace(/\s*-\s*[A-Z]+\s*$/, '').trim()
}

/**
 * Formats a Bible verse preview
 */
function formatBibleVersePreview(
  reference: string | null,
  text: string | null,
): string {
  const ref = stripTranslation(reference || '')
  const txt = text || ''
  return `${ref}: ${txt}`
}

/**
 * Formats an announcement preview
 */
function formatAnnouncementPreview(content: string | null): string {
  return stripHtml(content || '')
}

/**
 * Creates a versete tineri summary from entries
 */
function createVerseteTineriSummary(entries: VerseteTineriEntry[]): {
  entries: VerseteTineriSummaryEntry[]
  hasMore: boolean
} {
  const limitedEntries = entries.slice(0, MAX_VERSETE_TINERI_PREVIEW_ENTRIES)
  return {
    entries: limitedEntries.map((entry) => ({
      personName: entry.personName,
      reference: entry.reference,
    })),
    hasMore: entries.length > MAX_VERSETE_TINERI_PREVIEW_ENTRIES,
  }
}

/**
 * Formats a single versete tineri entry preview (name with reference in parentheses)
 */
function formatVerseteTineriEntryPreview(entry: VerseteTineriEntry): string {
  return `${entry.personName} (${entry.reference})`
}

/**
 * Creates NextSlideData from a queue item (for looking ahead to next queue item)
 */
function formatNextQueueItemPreview(
  item: QueueItem | undefined,
): NextSlideData | undefined {
  if (!item) return undefined

  switch (item.itemType) {
    case 'song': {
      const firstSlide = item.slides?.[0]
      if (!firstSlide) return undefined
      return {
        contentType: 'song' as ContentType,
        preview: formatSongPreview(firstSlide.content),
      }
    }

    case 'bible': {
      return {
        contentType: 'bible' as ContentType,
        preview: formatBibleVersePreview(item.bibleReference, item.bibleText),
      }
    }

    case 'bible_passage': {
      const firstVerse = item.biblePassageVerses?.[0]
      if (!firstVerse) return undefined
      return {
        contentType: 'bible_passage' as ContentType,
        preview: formatBibleVersePreview(firstVerse.reference, firstVerse.text),
      }
    }

    case 'slide': {
      if (item.slideType === 'versete_tineri') {
        const entries = item.verseteTineriEntries || []
        if (entries.length === 0) return undefined

        return {
          contentType: 'versete_tineri' as ContentType,
          preview: entries.map((e) => e.personName).join(', '),
          verseteTineriSummary: createVerseteTineriSummary(entries),
        }
      }

      // Announcement
      return {
        contentType: 'announcement' as ContentType,
        preview: formatAnnouncementPreview(item.slideContent),
      }
    }

    default:
      return undefined
  }
}

/**
 * Main function to calculate next slide data
 * Handles all content types and looks ahead to next queue item when needed
 */
export function calculateNextSlideData(
  params: CalculateNextSlideParams,
): NextSlideData | undefined {
  const { queueItems, presentationState, nextBibleVerse } = params
  const {
    currentQueueItemId,
    currentSongSlideId,
    currentBiblePassageVerseId,
    currentVerseteTineriEntryId,
  } = presentationState

  if (!currentQueueItemId || queueItems.length === 0) {
    return undefined
  }

  const currentItemIndex = queueItems.findIndex(
    (item) => item.id === currentQueueItemId,
  )
  if (currentItemIndex === -1) {
    return undefined
  }

  const currentItem = queueItems[currentItemIndex]
  const nextQueueItem = queueItems[currentItemIndex + 1]

  // Case 1: Song
  if (currentItem.itemType === 'song' && currentSongSlideId) {
    const slides = currentItem.slides || []
    const slideIndex = slides.findIndex(
      (s: SongSlide) => s.id === currentSongSlideId,
    )

    if (slideIndex !== -1 && slideIndex < slides.length - 1) {
      const nextSlide = slides[slideIndex + 1]
      return {
        contentType: 'song' as ContentType,
        preview: formatSongPreview(nextSlide.content),
      }
    }

    // At end of song, look at next queue item
    return formatNextQueueItemPreview(nextQueueItem)
  }

  // Case 2: Bible Passage
  if (currentItem.itemType === 'bible_passage') {
    const verses = currentItem.biblePassageVerses || []
    const verseId = currentBiblePassageVerseId || verses[0]?.id

    if (verseId) {
      const verseIndex = verses.findIndex((v) => v.id === verseId)

      if (verseIndex !== -1 && verseIndex < verses.length - 1) {
        const nextVerse = verses[verseIndex + 1]
        return {
          contentType: 'bible_passage' as ContentType,
          preview: formatBibleVersePreview(nextVerse.reference, nextVerse.text),
        }
      }
    }

    // At end of passage, look at next queue item or next Bible verse
    if (nextQueueItem) {
      return formatNextQueueItemPreview(nextQueueItem)
    }
    // No next queue item - show next verse from Bible if available
    if (nextBibleVerse) {
      return {
        contentType: 'bible' as ContentType,
        preview: formatBibleVersePreview(
          `${nextBibleVerse.bookName} ${nextBibleVerse.chapter}:${nextBibleVerse.verse}`,
          nextBibleVerse.text,
        ),
      }
    }
    return undefined
  }

  // Case 3: Versete Tineri
  if (
    currentItem.itemType === 'slide' &&
    currentItem.slideType === 'versete_tineri'
  ) {
    const entries = currentItem.verseteTineriEntries || []
    const entryId = currentVerseteTineriEntryId || entries[0]?.id

    if (entryId) {
      const entryIndex = entries.findIndex((e) => e.id === entryId)

      if (entryIndex !== -1 && entryIndex < entries.length - 1) {
        const nextEntry = entries[entryIndex + 1]
        return {
          contentType: 'versete_tineri' as ContentType,
          preview: formatVerseteTineriEntryPreview(nextEntry),
        }
      }
    }

    // At end of versete tineri group, look at next queue item
    return formatNextQueueItemPreview(nextQueueItem)
  }

  // Case 4: Single Bible Verse - look at next queue item or next Bible verse
  if (currentItem.itemType === 'bible') {
    if (nextQueueItem) {
      return formatNextQueueItemPreview(nextQueueItem)
    }
    // No next queue item - show next verse from Bible if available
    if (nextBibleVerse) {
      return {
        contentType: 'bible' as ContentType,
        preview: formatBibleVersePreview(
          `${nextBibleVerse.bookName} ${nextBibleVerse.chapter}:${nextBibleVerse.verse}`,
          nextBibleVerse.text,
        ),
      }
    }
    return undefined
  }

  // Case 5: Announcement - always look at next queue item
  if (
    currentItem.itemType === 'slide' &&
    currentItem.slideType === 'announcement'
  ) {
    return formatNextQueueItemPreview(nextQueueItem)
  }

  // Fallback: look at next queue item
  return formatNextQueueItemPreview(nextQueueItem)
}
