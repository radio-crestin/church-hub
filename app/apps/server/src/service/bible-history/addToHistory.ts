import { and, eq, sql } from 'drizzle-orm'

import type { AddToHistoryInput, BibleHistoryItem } from './types'
import { getDatabase } from '../../db'
import { bibleHistory } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible-history] ${message}`)
}

/**
 * Adds a verse to the Bible history, or updates timestamp if already exists
 */
export function addToHistory(
  input: AddToHistoryInput,
): { data: BibleHistoryItem } | { error: string } {
  try {
    log('debug', `Adding verse to history: ${input.reference}`)

    const db = getDatabase()

    // Check if verse already exists in history (same verse and translation)
    const existing = db
      .select()
      .from(bibleHistory)
      .where(
        and(
          eq(bibleHistory.verseId, input.verseId),
          eq(bibleHistory.translationId, input.translationId),
        ),
      )
      .get()

    if (existing) {
      // Update timestamp to move it to the end of the list
      const updated = db
        .update(bibleHistory)
        .set({ createdAt: sql`(unixepoch())` })
        .where(eq(bibleHistory.id, existing.id))
        .returning()
        .get()

      log('info', `Verse timestamp updated in history: ${updated.id}`)

      return {
        data: {
          id: updated.id,
          verseId: updated.verseId,
          reference: updated.reference,
          text: updated.text,
          translationAbbreviation: updated.translationAbbreviation,
          bookName: updated.bookName,
          translationId: updated.translationId,
          bookId: updated.bookId,
          chapter: updated.chapter,
          verse: updated.verse,
          createdAt: updated.createdAt.getTime(),
        },
      }
    }

    // Insert new entry
    const inserted = db
      .insert(bibleHistory)
      .values({
        verseId: input.verseId,
        reference: input.reference,
        text: input.text,
        translationAbbreviation: input.translationAbbreviation,
        bookName: input.bookName,
        translationId: input.translationId,
        bookId: input.bookId,
        chapter: input.chapter,
        verse: input.verse,
      })
      .returning()
      .get()

    log('info', `Verse added to history: ${inserted.id}`)

    return {
      data: {
        id: inserted.id,
        verseId: inserted.verseId,
        reference: inserted.reference,
        text: inserted.text,
        translationAbbreviation: inserted.translationAbbreviation,
        bookName: inserted.bookName,
        translationId: inserted.translationId,
        bookId: inserted.bookId,
        chapter: inserted.chapter,
        verse: inserted.verse,
        createdAt: inserted.createdAt.getTime(),
      },
    }
  } catch (error) {
    log('error', `Failed to add to history: ${error}`)
    return { error: String(error) }
  }
}
