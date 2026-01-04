import { asc } from 'drizzle-orm'

import type { BibleHistoryItem } from './types'
import { getDatabase } from '../../db'
import { bibleHistory } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible-history] ${message}`)
}

/**
 * Gets all Bible history items, ordered by oldest first
 */
export function getHistory(): BibleHistoryItem[] {
  try {
    log('debug', 'Getting Bible history')

    const db = getDatabase()
    const records = db
      .select()
      .from(bibleHistory)
      .orderBy(asc(bibleHistory.createdAt))
      .all()

    log('debug', `Found ${records.length} history items`)

    return records.map((record) => ({
      id: record.id,
      verseId: record.verseId,
      reference: record.reference,
      text: record.text,
      translationAbbreviation: record.translationAbbreviation,
      bookName: record.bookName,
      translationId: record.translationId,
      bookId: record.bookId,
      chapter: record.chapter,
      verse: record.verse,
      createdAt: record.createdAt.getTime(),
    }))
  } catch (error) {
    log('error', `Failed to get history: ${error}`)
    return []
  }
}
