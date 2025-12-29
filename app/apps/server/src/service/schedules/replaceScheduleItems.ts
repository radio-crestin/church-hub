import { eq } from 'drizzle-orm'

import { getScheduleById } from './getSchedules'
import { updateScheduleSearchIndex } from './search'
import type {
  OperationResult,
  SlideTemplate,
  VerseteTineriEntryInput,
} from './types'
import { getDatabase } from '../../db'
import {
  scheduleBiblePassageVerses,
  scheduleItems,
  schedules,
  scheduleVerseteTineriEntries,
} from '../../db/schema'
import { getVerseRange, getVersesAcrossChapters } from '../bible'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
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
    if (startVerse === endVerse) {
      ref = `${bookName} ${startChapter}:${startVerse}`
    } else {
      ref = `${bookName} ${startChapter}:${startVerse}-${endVerse}`
    }
  } else {
    ref = `${bookName} ${startChapter}:${startVerse} - ${endChapter}:${endVerse}`
  }
  return translationAbbreviation ? `${ref} - ${translationAbbreviation}` : ref
}

/**
 * Input for a single item to replace
 */
export interface ReplaceItemInput {
  type: 'song' | 'slide'
  songId?: number
  slideType?: SlideTemplate
  slideContent?: string
  // Bible passage fields
  biblePassage?: {
    translationId: number
    translationAbbreviation: string
    bookCode: string
    bookName: string
    startChapter: number
    startVerse: number
    endChapter: number
    endVerse: number
  }
  // Versete Tineri entries
  verseteTineriEntries?: VerseteTineriEntryInput[]
}

/**
 * Input for replacing all items in a schedule
 */
export interface ReplaceScheduleItemsInput {
  scheduleId: number
  items: ReplaceItemInput[]
}

/**
 * Result of replace operation
 */
export interface ReplaceScheduleItemsResult extends OperationResult {
  schedule?: {
    id: number
    title: string
    itemCount: number
  }
}

/**
 * Replaces all items in a schedule with new items
 * Deletes existing items and inserts new ones in order
 */
export function replaceScheduleItems(
  input: ReplaceScheduleItemsInput,
): ReplaceScheduleItemsResult {
  try {
    log('debug', `Replacing items in schedule: ${input.scheduleId}`)

    const db = getDatabase()
    const now = new Date()

    // Verify schedule exists
    const schedule = getScheduleById(input.scheduleId)
    if (!schedule) {
      log('error', `Schedule not found: ${input.scheduleId}`)
      return { success: false, error: 'Schedule not found' }
    }

    // Delete all existing items for this schedule
    db.delete(scheduleItems)
      .where(eq(scheduleItems.scheduleId, input.scheduleId))
      .run()

    log('debug', `Deleted existing items for schedule: ${input.scheduleId}`)

    // Insert new items with correct sort order
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i]

      if (item.type === 'song' && item.songId) {
        db.insert(scheduleItems)
          .values({
            scheduleId: input.scheduleId,
            itemType: 'song',
            songId: item.songId,
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      } else if (item.biblePassage) {
        // Handle Bible passage item
        const passage = item.biblePassage
        const passageRef = formatPassageReference(
          passage.bookName,
          passage.startChapter,
          passage.startVerse,
          passage.endChapter,
          passage.endVerse,
          passage.translationAbbreviation,
        )

        // Fetch verses in the range
        const verses =
          passage.startChapter === passage.endChapter
            ? getVerseRange(
                passage.translationId,
                passage.bookCode,
                passage.startChapter,
                passage.startVerse,
                passage.endVerse,
              )
            : getVersesAcrossChapters(
                passage.translationId,
                passage.bookCode,
                passage.startChapter,
                passage.startVerse,
                passage.endChapter,
                passage.endVerse,
              )

        if (verses.length === 0) {
          log('warning', `No verses found for passage: ${passageRef}`)
          continue
        }

        const result = db
          .insert(scheduleItems)
          .values({
            scheduleId: input.scheduleId,
            itemType: 'bible_passage',
            biblePassageReference: passageRef,
            biblePassageTranslation: passage.translationAbbreviation,
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: scheduleItems.id })
          .get()
        const itemId = result.id

        // Insert individual verses
        for (let j = 0; j < verses.length; j++) {
          const verse = verses[j]
          const verseReference = `${verse.bookName} ${verse.chapter}:${verse.verse}`

          db.insert(scheduleBiblePassageVerses)
            .values({
              scheduleItemId: itemId,
              verseId: verse.id,
              reference: verseReference,
              text: verse.text,
              sortOrder: j,
            })
            .run()
        }

        log('debug', `Bible passage added with ${verses.length} verses`)
      } else if (
        item.slideType === 'versete_tineri' &&
        item.verseteTineriEntries
      ) {
        // Handle Versete Tineri slide with entries
        const result = db
          .insert(scheduleItems)
          .values({
            scheduleId: input.scheduleId,
            itemType: 'slide',
            slideType: 'versete_tineri',
            slideContent: null,
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: scheduleItems.id })
          .get()
        const itemId = result.id

        // Insert versete tineri entries
        const entries = item.verseteTineriEntries
        for (let j = 0; j < entries.length; j++) {
          const entry = entries[j]

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
              `No verses found for entry ${j}: ${entry.bookName} ${entry.startChapter}:${entry.startVerse}`,
            )
            continue
          }

          // Combine verse text
          const combinedText = verses.map((v) => v.text).join(' ')

          // Format reference
          const reference = formatPassageReference(
            entry.bookName,
            entry.startChapter,
            entry.startVerse,
            entry.endChapter,
            entry.endVerse,
          )

          db.insert(scheduleVerseteTineriEntries)
            .values({
              scheduleItemId: itemId,
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
              sortOrder: j,
            })
            .run()
        }

        log('debug', `Versete Tineri added with ${entries.length} entries`)
      } else if (item.type === 'slide' && item.slideType && item.slideContent) {
        db.insert(scheduleItems)
          .values({
            scheduleId: input.scheduleId,
            itemType: 'slide',
            slideType: item.slideType,
            slideContent: item.slideContent,
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      }
    }

    // Update schedule's updated_at
    db.update(schedules)
      .set({ updatedAt: now })
      .where(eq(schedules.id, input.scheduleId))
      .run()

    // Update search index
    updateScheduleSearchIndex(input.scheduleId)

    log(
      'info',
      `Replaced ${input.items.length} items in schedule: ${input.scheduleId}`,
    )

    return {
      success: true,
      schedule: {
        id: input.scheduleId,
        title: schedule.title,
        itemCount: input.items.length,
      },
    }
  } catch (error) {
    log('error', `Failed to replace schedule items: ${error}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
