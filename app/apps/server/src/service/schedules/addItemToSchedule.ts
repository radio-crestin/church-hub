import { and, eq, gte, max, sql } from 'drizzle-orm'

import { getScheduleItemById } from './getSchedules'
import { updateScheduleSearchIndex } from './search'
import type { AddToScheduleInput, ScheduleItem } from './types'
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
 * Adds an item (song, slide, or bible_passage) to a schedule
 */
export function addItemToSchedule(
  input: AddToScheduleInput,
): ScheduleItem | null {
  try {
    const isSong = input.songId !== undefined
    const isBiblePassage = input.biblePassage !== undefined
    const isVerseteTineri =
      input.slideType === 'versete_tineri' &&
      input.verseteTineriEntries !== undefined
    const isScene =
      input.slideType === 'scene' && input.obsSceneName !== undefined

    let itemTypeStr = 'slide'
    if (isSong) itemTypeStr = 'song'
    else if (isBiblePassage) itemTypeStr = 'bible_passage'
    else if (isVerseteTineri) itemTypeStr = 'versete_tineri'
    else if (isScene) itemTypeStr = 'scene'

    log('debug', `Adding ${itemTypeStr} to schedule: ${input.scheduleId}`)

    const db = getDatabase()
    const now = new Date()

    let targetOrder: number

    if (input.afterItemId) {
      // Get the sort_order of the item we're inserting after
      const afterItem = db
        .select({ sortOrder: scheduleItems.sortOrder })
        .from(scheduleItems)
        .where(eq(scheduleItems.id, input.afterItemId))
        .get()

      if (!afterItem) {
        log('error', `Schedule item not found: ${input.afterItemId}`)
        return null
      }

      targetOrder = afterItem.sortOrder + 1

      // Shift all items after the target position
      db.update(scheduleItems)
        .set({
          sortOrder: sql`${scheduleItems.sortOrder} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(scheduleItems.scheduleId, input.scheduleId),
            gte(scheduleItems.sortOrder, targetOrder),
          ),
        )
        .run()
    } else {
      // Get the max sort_order to append at the end
      const maxOrderResult = db
        .select({ maxOrder: max(scheduleItems.sortOrder) })
        .from(scheduleItems)
        .where(eq(scheduleItems.scheduleId, input.scheduleId))
        .get()
      targetOrder = (maxOrderResult?.maxOrder ?? -1) + 1
    }

    // Insert the item
    let itemId: number

    if (isSong) {
      const result = db
        .insert(scheduleItems)
        .values({
          scheduleId: input.scheduleId,
          itemType: 'song',
          songId: input.songId!,
          sortOrder: targetOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: scheduleItems.id })
        .get()
      itemId = result.id
    } else if (isBiblePassage) {
      // Handle Bible passage item
      const passage = input.biblePassage!
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

      const result = db
        .insert(scheduleItems)
        .values({
          scheduleId: input.scheduleId,
          itemType: 'bible_passage',
          biblePassageReference: passageRef,
          biblePassageTranslation: passage.translationAbbreviation,
          sortOrder: targetOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: scheduleItems.id })
        .get()
      itemId = result.id

      // Insert individual verses
      for (let i = 0; i < verses.length; i++) {
        const verse = verses[i]
        const verseReference = `${verse.bookName} ${verse.chapter}:${verse.verse}`

        db.insert(scheduleBiblePassageVerses)
          .values({
            scheduleItemId: itemId,
            verseId: verse.id,
            reference: verseReference,
            text: verse.text,
            sortOrder: i,
          })
          .run()
      }

      log('info', `Bible passage added with ${verses.length} verses`)
    } else if (isVerseteTineri) {
      // Handle Versete Tineri slide with entries
      const result = db
        .insert(scheduleItems)
        .values({
          scheduleId: input.scheduleId,
          itemType: 'slide',
          slideType: 'versete_tineri',
          slideContent: null, // Content is stored in entries
          sortOrder: targetOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: scheduleItems.id })
        .get()
      itemId = result.id

      // Insert versete tineri entries
      const entries = input.verseteTineriEntries!
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
            sortOrder: i,
          })
          .run()
      }

      log('info', `Versete Tineri added with ${entries.length} entries`)
    } else if (isScene) {
      // Handle Scene slide (OBS scene switch)
      const result = db
        .insert(scheduleItems)
        .values({
          scheduleId: input.scheduleId,
          itemType: 'slide',
          slideType: 'scene',
          slideContent: null,
          obsSceneName: input.obsSceneName!,
          sortOrder: targetOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: scheduleItems.id })
        .get()
      itemId = result.id

      log('info', `Scene added: ${input.obsSceneName}`)
    } else {
      // Regular slide (announcement)
      const result = db
        .insert(scheduleItems)
        .values({
          scheduleId: input.scheduleId,
          itemType: 'slide',
          slideType: input.slideType!,
          slideContent: input.slideContent!,
          sortOrder: targetOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: scheduleItems.id })
        .get()
      itemId = result.id
    }

    // Update schedule's updated_at
    db.update(schedules)
      .set({ updatedAt: now })
      .where(eq(schedules.id, input.scheduleId))
      .run()

    // Update search index
    updateScheduleSearchIndex(input.scheduleId)

    log('info', `Item added to schedule: ${itemId}`)

    return getScheduleItemById(itemId)
  } catch (error) {
    log('error', `Failed to add item to schedule: ${error}`)
    return null
  }
}
