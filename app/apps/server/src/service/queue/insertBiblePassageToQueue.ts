import { eq, gte, max, sql } from 'drizzle-orm'

import { getQueueItemById } from './getQueue'
import type { InsertBiblePassageInput, QueueItem } from './types'
import { getDatabase } from '../../db'
import { biblePassageVerses, presentationQueue } from '../../db/schema'
import { getVerseRange, getVersesAcrossChapters } from '../bible'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Formats a passage reference string for cross-chapter or same-chapter ranges
 */
function formatPassageReference(
  bookName: string,
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number,
  translationAbbreviation?: string,
): string {
  let ref: string
  if (startChapter === endChapter) {
    // Same chapter: "John 3:16-20"
    if (startVerse === endVerse) {
      ref = `${bookName} ${startChapter}:${startVerse}`
    } else {
      ref = `${bookName} ${startChapter}:${startVerse}-${endVerse}`
    }
  } else {
    // Cross chapter: "John 3:16 - 4:3"
    ref = `${bookName} ${startChapter}:${startVerse} - ${endChapter}:${endVerse}`
  }
  return translationAbbreviation ? `${ref} - ${translationAbbreviation}` : ref
}

/**
 * Inserts a Bible passage (range of verses) into the presentation queue
 * Creates a single queue item with nested verses
 */
export function insertBiblePassageToQueue(
  input: InsertBiblePassageInput,
): QueueItem | null {
  try {
    const passageRef = formatPassageReference(
      input.bookName,
      input.startChapter,
      input.startVerse,
      input.endChapter,
      input.endVerse,
      input.translationAbbreviation,
    )

    log(
      'debug',
      `Inserting Bible passage to queue: ${passageRef}${input.afterItemId ? ` after item ${input.afterItemId}` : ''}`,
    )

    // Fetch verses in the range
    const verses =
      input.startChapter === input.endChapter
        ? getVerseRange(
            input.translationId,
            input.bookCode,
            input.startChapter,
            input.startVerse,
            input.endVerse,
          )
        : getVersesAcrossChapters(
            input.translationId,
            input.bookCode,
            input.startChapter,
            input.startVerse,
            input.endChapter,
            input.endVerse,
          )

    if (verses.length === 0) {
      log('error', `No verses found for passage: ${passageRef}`)
      return null
    }

    log('debug', `Found ${verses.length} verses for passage`)

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

    // Insert the Bible passage queue item
    const inserted = db
      .insert(presentationQueue)
      .values({
        itemType: 'bible_passage',
        songId: null,
        slideType: null,
        slideContent: null,
        bibleVerseId: null,
        bibleReference: null,
        bibleText: null,
        bibleTranslation: null,
        biblePassageReference: passageRef,
        biblePassageTranslation: input.translationAbbreviation,
        sortOrder: targetOrder,
        isExpanded: true,
      })
      .returning({ id: presentationQueue.id })
      .get()

    // Insert individual verses into bible_passage_verses table
    for (let i = 0; i < verses.length; i++) {
      const verse = verses[i]
      const verseReference = `${verse.bookName} ${verse.chapter}:${verse.verse}`

      db.insert(biblePassageVerses)
        .values({
          queueItemId: inserted.id,
          verseId: verse.id,
          reference: verseReference,
          text: verse.text,
          sortOrder: i,
        })
        .run()
    }

    log(
      'info',
      `Bible passage added to queue: ${inserted.id} (${passageRef}) with ${verses.length} verses`,
    )

    return getQueueItemById(inserted.id)
  } catch (error) {
    log('error', `Failed to insert Bible passage to queue: ${error}`)
    return null
  }
}
