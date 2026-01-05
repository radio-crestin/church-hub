import { eq } from 'drizzle-orm'

import { getScheduleItemById } from './getSchedules'
import type { ScheduleItem, UpdateScheduleSlideInput } from './types'
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
 * Updates a slide or bible passage in a schedule
 */
export function updateScheduleSlide(
  input: UpdateScheduleSlideInput,
): ScheduleItem | null {
  try {
    log('debug', `Updating schedule item: ${input.id}`)

    const db = getDatabase()
    const now = new Date()

    // Verify item exists
    const existingItem = db
      .select({
        itemType: scheduleItems.itemType,
        scheduleId: scheduleItems.scheduleId,
      })
      .from(scheduleItems)
      .where(eq(scheduleItems.id, input.id))
      .get()

    if (!existingItem) {
      log('error', `Schedule item not found: ${input.id}`)
      return null
    }

    // Handle Bible passage update
    if (input.biblePassage && existingItem.itemType === 'bible_passage') {
      const passage = input.biblePassage
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
        log('error', `No verses found for passage: ${passageRef}`)
        return null
      }

      // Update the schedule item
      db.update(scheduleItems)
        .set({
          biblePassageReference: passageRef,
          biblePassageTranslation: passage.translationAbbreviation,
          updatedAt: now,
        })
        .where(eq(scheduleItems.id, input.id))
        .run()

      // Delete existing verses
      db.delete(scheduleBiblePassageVerses)
        .where(eq(scheduleBiblePassageVerses.scheduleItemId, input.id))
        .run()

      // Insert new verses
      for (let i = 0; i < verses.length; i++) {
        const verse = verses[i]
        const verseReference = `${verse.bookName} ${verse.chapter}:${verse.verse}`

        db.insert(scheduleBiblePassageVerses)
          .values({
            scheduleItemId: input.id,
            verseId: verse.id,
            reference: verseReference,
            text: verse.text,
            sortOrder: i,
          })
          .run()
      }

      // Update schedule's updated_at
      db.update(schedules)
        .set({ updatedAt: now })
        .where(eq(schedules.id, existingItem.scheduleId))
        .run()

      log(
        'info',
        `Bible passage updated with ${verses.length} verses: ${input.id}`,
      )
      return getScheduleItemById(input.id)
    }

    // Handle slide update
    if (existingItem.itemType !== 'slide') {
      log('error', `Cannot update non-slide item with slide data: ${input.id}`)
      return null
    }

    // Handle Versete Tineri update
    if (
      input.slideType === 'versete_tineri' &&
      input.verseteTineriEntries &&
      input.verseteTineriEntries.length > 0
    ) {
      // Update the slide type
      db.update(scheduleItems)
        .set({
          slideType: 'versete_tineri',
          slideContent: null,
          updatedAt: now,
        })
        .where(eq(scheduleItems.id, input.id))
        .run()

      // Delete existing entries
      db.delete(scheduleVerseteTineriEntries)
        .where(eq(scheduleVerseteTineriEntries.scheduleItemId, input.id))
        .run()

      // Insert new entries
      const entries = input.verseteTineriEntries
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]

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
        const reference = formatPassageReference(
          entry.bookName,
          entry.startChapter,
          entry.startVerse,
          entry.endChapter,
          entry.endVerse,
        )

        db.insert(scheduleVerseteTineriEntries)
          .values({
            scheduleItemId: input.id,
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

      // Update schedule's updated_at
      db.update(schedules)
        .set({ updatedAt: now })
        .where(eq(schedules.id, existingItem.scheduleId))
        .run()

      log(
        'info',
        `Versete Tineri updated with ${entries.length} entries: ${input.id}`,
      )
      return getScheduleItemById(input.id)
    }

    // Update regular slide (announcement)
    db.update(scheduleItems)
      .set({
        slideType: input.slideType,
        slideContent: input.slideContent,
        updatedAt: now,
      })
      .where(eq(scheduleItems.id, input.id))
      .run()

    // Update schedule's updated_at
    db.update(schedules)
      .set({ updatedAt: now })
      .where(eq(schedules.id, existingItem.scheduleId))
      .run()

    log('info', `Schedule slide updated: ${input.id}`)

    return getScheduleItemById(input.id)
  } catch (error) {
    log('error', `Failed to update schedule item: ${error}`)
    return null
  }
}
