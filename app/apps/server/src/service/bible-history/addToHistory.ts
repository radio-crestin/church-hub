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
 * Adds a verse to the Bible history
 */
export function addToHistory(
  input: AddToHistoryInput,
): { data: BibleHistoryItem } | { error: string } {
  try {
    log('debug', `Adding verse to history: ${input.reference}`)

    const db = getDatabase()

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
