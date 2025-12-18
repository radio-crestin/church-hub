import { eq, gte, max, sql } from 'drizzle-orm'

import { getQueueItemById } from './getQueue'
import type { InsertVerseteTineriInput, QueueItem } from './types'
import { getDatabase } from '../../db'
import { presentationQueue, verseteTineriEntries } from '../../db/schema'
import {
  formatRangeReference,
  getVerseRange,
  getVersesAcrossChapters,
} from '../bible'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Inserts a Versete Tineri group (multiple person-verse entries) into the presentation queue
 * Creates a single queue item with nested entries
 */
export function insertVerseteTineriToQueue(
  input: InsertVerseteTineriInput,
): QueueItem | null {
  try {
    if (input.entries.length === 0) {
      log('error', 'No entries provided for Versete Tineri')
      return null
    }

    log(
      'debug',
      `Inserting Versete Tineri with ${input.entries.length} entries${input.afterItemId ? ` after item ${input.afterItemId}` : ''}`,
    )

    const db = getDatabase()

    let targetOrder: number

    if (input.afterItemId) {
      // Get the sort_order of the item we're inserting after
      const afterItem = db
        .select({ sortOrder: presentationQueue.sortOrder })
        .from(presentationQueue)
        .where(eq(presentationQueue.id, input.afterItemId))
        .get()

      if (!afterItem) {
        log('error', `Queue item not found: ${input.afterItemId}`)
        return null
      }

      targetOrder = afterItem.sortOrder + 1

      // Shift all items after the target position
      db.update(presentationQueue)
        .set({
          sortOrder: sql`${presentationQueue.sortOrder} + 1`,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(gte(presentationQueue.sortOrder, targetOrder))
        .run()
    } else {
      // Append to the end
      const maxOrderResult = db
        .select({ maxOrder: max(presentationQueue.sortOrder) })
        .from(presentationQueue)
        .get()
      targetOrder = (maxOrderResult?.maxOrder ?? -1) + 1
    }

    // Insert the Versete Tineri queue item
    const inserted = db
      .insert(presentationQueue)
      .values({
        itemType: 'slide',
        songId: null,
        slideType: 'versete_tineri',
        slideContent: null, // Content is stored in versete_tineri_entries
        bibleVerseId: null,
        bibleReference: null,
        bibleText: null,
        bibleTranslation: null,
        biblePassageReference: null,
        biblePassageTranslation: null,
        sortOrder: targetOrder,
        isExpanded: true,
      })
      .returning({ id: presentationQueue.id })
      .get()

    // Insert individual entries into versete_tineri_entries table
    for (let i = 0; i < input.entries.length; i++) {
      const entry = input.entries[i]

      // Fetch verses for this entry
      const verses =
        entry.startChapter === entry.endChapter
          ? getVerseRange(
              entry.translationId,
              entry.bookCode,
              entry.startChapter,
              entry.startVerse,
              entry.endVerse,
            )
          : getVersesAcrossChapters(
              entry.translationId,
              entry.bookCode,
              entry.startChapter,
              entry.startVerse,
              entry.endChapter,
              entry.endVerse,
            )

      if (verses.length === 0) {
        log(
          'warning',
          `No verses found for entry ${i}: ${entry.bookName} ${entry.startChapter}:${entry.startVerse}`,
        )
        continue
      }

      // Combine verse text
      const combinedText = verses.map((v) => v.text).join(' ')

      // Format reference
      const reference = formatRangeReference(
        entry.bookName,
        entry.startChapter,
        entry.startVerse,
        entry.endChapter,
        entry.endVerse,
      )

      db.insert(verseteTineriEntries)
        .values({
          queueItemId: inserted.id,
          personName: entry.personName,
          translationId: entry.translationId,
          bookCode: entry.bookCode,
          bookName: entry.bookName,
          reference,
          text: combinedText,
          startChapter: entry.startChapter,
          startVerse: entry.startVerse,
          endChapter: entry.endChapter,
          endVerse: entry.endVerse,
          sortOrder: i,
        })
        .run()
    }

    log(
      'info',
      `Versete Tineri added to queue: ${inserted.id} with ${input.entries.length} entries`,
    )

    return getQueueItemById(inserted.id)
  } catch (error) {
    log('error', `Failed to insert Versete Tineri to queue: ${error}`)
    return null
  }
}
