import { max } from 'drizzle-orm'

import { getScheduleById } from './getSchedules'
import { getDatabase } from '../../db'
import {
  biblePassageVerses,
  presentationQueue,
  verseteTineriEntries,
} from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Imports all items from a schedule into the presentation queue
 * Items are appended to the end of the queue in order
 */
export function importScheduleToQueue(scheduleId: number): boolean {
  try {
    log('debug', `Importing schedule to queue: ${scheduleId}`)

    const db = getDatabase()
    const now = new Date()

    // Get the schedule with all items
    const schedule = getScheduleById(scheduleId)
    if (!schedule) {
      log('error', `Schedule not found: ${scheduleId}`)
      return false
    }

    if (schedule.items.length === 0) {
      log('debug', `Schedule has no items: ${scheduleId}`)
      return true
    }

    // Get current max sort_order in queue
    const maxOrderResult = db
      .select({ maxOrder: max(presentationQueue.sortOrder) })
      .from(presentationQueue)
      .get()
    let nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1

    // Insert each schedule item into the queue
    for (const item of schedule.items) {
      if (item.itemType === 'song' && item.songId) {
        db.insert(presentationQueue)
          .values({
            itemType: 'song',
            songId: item.songId,
            sortOrder: nextOrder,
            isExpanded: true,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      } else if (item.itemType === 'bible_passage') {
        // Insert Bible passage as proper bible_passage queue item
        const inserted = db
          .insert(presentationQueue)
          .values({
            itemType: 'bible_passage',
            biblePassageReference: item.biblePassageReference,
            biblePassageTranslation: item.biblePassageTranslation,
            sortOrder: nextOrder,
            isExpanded: true,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: presentationQueue.id })
          .get()

        // Copy bible passage verses from schedule to queue
        for (const verse of item.biblePassageVerses) {
          db.insert(biblePassageVerses)
            .values({
              queueItemId: inserted.id,
              verseId: verse.verseId,
              reference: verse.reference,
              text: verse.text,
              sortOrder: verse.sortOrder,
            })
            .run()
        }

        log(
          'debug',
          `Imported bible_passage with ${item.biblePassageVerses.length} verses`,
        )
      } else if (
        item.itemType === 'slide' &&
        item.slideType === 'versete_tineri'
      ) {
        // Insert Versete Tineri slide with entries
        const inserted = db
          .insert(presentationQueue)
          .values({
            itemType: 'slide',
            slideType: 'versete_tineri',
            slideContent: null, // Content stored in entries
            sortOrder: nextOrder,
            isExpanded: true,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: presentationQueue.id })
          .get()

        // Copy versete tineri entries from schedule to queue
        for (const entry of item.verseteTineriEntries) {
          db.insert(verseteTineriEntries)
            .values({
              queueItemId: inserted.id,
              personName: entry.personName,
              translationId: entry.translationId,
              bookCode: entry.bookCode,
              bookName: entry.bookName,
              reference: entry.reference,
              text: entry.text,
              startChapter: entry.startChapter,
              startVerse: entry.startVerse,
              endChapter: entry.endChapter,
              endVerse: entry.endVerse,
              sortOrder: entry.sortOrder,
            })
            .run()
        }

        log(
          'debug',
          `Imported versete_tineri with ${item.verseteTineriEntries.length} entries`,
        )
      } else if (item.itemType === 'slide') {
        // Regular announcement slide
        db.insert(presentationQueue)
          .values({
            itemType: 'slide',
            slideType: item.slideType!,
            slideContent: item.slideContent!,
            sortOrder: nextOrder,
            isExpanded: true,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      }
      nextOrder++
    }

    log(
      'info',
      `Imported ${schedule.items.length} items from schedule ${scheduleId} to queue`,
    )
    return true
  } catch (error) {
    log('error', `Failed to import schedule to queue: ${error}`)
    return false
  }
}
