import { formatPassageReference } from './formatPassageReference'
import type { Database } from 'bun:sqlite'

/**
 * One stored verse row of a legacy `bible_passage` item.
 */
export interface LegacyBiblePassageVerse {
  verseId: number
  reference: string
  text: string
  sortOrder: number
}

/**
 * A legacy `bible_passage` item, exactly as it is stored on disk, exported to a
 * .churchprogram file or received from a cloud-synced library.
 */
export interface LegacyBiblePassage {
  /** Display reference, e.g. "Ioan 3:16 - RCCV" (translation suffix included). */
  reference: string | null
  translationAbbreviation: string | null
  verses: LegacyBiblePassageVerse[]
}

/**
 * The single "Versete Biblice" entry a legacy passage becomes.
 */
export interface ResolvedLegacyBiblePassage {
  personName: string
  translationId: number
  bookCode: string
  bookName: string
  reference: string
  text: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
}

export type LegacyBiblePassageResolution =
  | {
      ok: true
      entry: ResolvedLegacyBiblePassage
      /** Which route produced the entry, for logging. */
      source: 'verse_ids' | 'reference'
    }
  | { ok: false; reason: string }

interface VerseRow {
  translation_id: number
  book_id: number
  book_code: string
  book_name: string
  chapter: number
  verse: number
  text: string
}

/**
 * Strips the translation suffix the app appends to a display reference
 * ("Ioan 3:16 - RCCV" -> "Ioan 3:16"). Same expression the picker uses when it
 * reopens an existing passage.
 */
function stripTranslationSuffix(reference: string): string {
  return reference.replace(/\s+-\s+[A-Za-z0-9]+$/, '').trim()
}

/** The abbreviation carried by a display reference, if it has one. */
function translationSuffixOf(reference: string): string | null {
  return reference.match(/\s+-\s+([A-Za-z0-9]+)$/)?.[1] ?? null
}

interface ParsedReference {
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
}

/**
 * Parses the three shapes formatPassageReference can produce.
 */
function parsePassageReference(reference: string): ParsedReference | null {
  const ref = stripTranslationSuffix(reference)

  const crossChapter = ref.match(/^(.+?)\s+(\d+):(\d+)\s+-\s+(\d+):(\d+)$/)
  if (crossChapter) {
    const [, bookName, startChapter, startVerse, endChapter, endVerse] =
      crossChapter
    if (bookName && startChapter && startVerse && endChapter && endVerse) {
      return {
        bookName: bookName.trim(),
        startChapter: Number(startChapter),
        startVerse: Number(startVerse),
        endChapter: Number(endChapter),
        endVerse: Number(endVerse),
      }
    }
  }

  const verseRange = ref.match(/^(.+?)\s+(\d+):(\d+)\s*-\s*(\d+)$/)
  if (verseRange) {
    const [, bookName, chapter, startVerse, endVerse] = verseRange
    if (bookName && chapter && startVerse && endVerse) {
      return {
        bookName: bookName.trim(),
        startChapter: Number(chapter),
        startVerse: Number(startVerse),
        endChapter: Number(chapter),
        endVerse: Number(endVerse),
      }
    }
  }

  const single = ref.match(/^(.+?)\s+(\d+):(\d+)$/)
  if (single) {
    const [, bookName, chapter, verse] = single
    if (bookName && chapter && verse) {
      return {
        bookName: bookName.trim(),
        startChapter: Number(chapter),
        startVerse: Number(verse),
        endChapter: Number(chapter),
        endVerse: Number(verse),
      }
    }
  }

  return null
}

/**
 * Preferred route: the stored verse ids point straight at the local Bible, so
 * the translation, book and verse range come from the database instead of a
 * display string. Returns null when the ids do not resolve here (a passage
 * synced from a machine with a different Bible import), when they straddle more
 * than one translation or book, or when the resolved verse disagrees with the
 * reference stored next to it.
 */
function resolveFromVerseIds(
  db: Database,
  verses: LegacyBiblePassageVerse[],
): ResolvedLegacyBiblePassage | null {
  if (verses.length === 0) return null

  const lookup = db.query<VerseRow, [number]>(
    `SELECT bv.translation_id, bv.book_id, bb.book_code, bb.book_name,
            bv.chapter, bv.verse, bv.text
     FROM bible_verses bv
     JOIN bible_books bb ON bb.id = bv.book_id
     WHERE bv.id = ?`,
  )

  const rows: VerseRow[] = []
  const texts: string[] = []
  for (const verse of verses) {
    const row = lookup.get(verse.verseId)
    if (!row) return null

    // The stored per-verse reference ends in "<chapter>:<verse>". If the local
    // verse with that id says something else, the ids belong to another Bible
    // data set and must not be trusted.
    const tail = verse.reference.match(/(\d+):(\d+)\s*$/)
    if (
      tail &&
      (Number(tail[1]) !== row.chapter || Number(tail[2]) !== row.verse)
    ) {
      return null
    }

    rows.push(row)
    texts.push(verse.text.trim() || row.text)
  }

  const first = rows[0]
  const last = rows[rows.length - 1]
  if (!first || !last) return null
  if (rows.some((row) => row.translation_id !== first.translation_id)) {
    return null
  }
  if (rows.some((row) => row.book_id !== first.book_id)) return null

  const text = texts.join(' ')

  return {
    personName: '',
    translationId: first.translation_id,
    bookCode: first.book_code,
    bookName: first.book_name,
    reference: formatPassageReference(
      first.book_name,
      first.chapter,
      first.verse,
      last.chapter,
      last.verse,
    ),
    text,
    startChapter: first.chapter,
    startVerse: first.verse,
    endChapter: last.chapter,
    endVerse: last.verse,
  }
}

/**
 * Fallback route, used when the verse ids are missing or foreign: re-parse the
 * display reference and re-read the verses from the local Bible.
 */
function resolveFromReference(
  db: Database,
  passage: LegacyBiblePassage,
): { entry: ResolvedLegacyBiblePassage } | { reason: string } {
  if (!passage.reference) return { reason: 'no_reference' }

  const parsed = parsePassageReference(passage.reference)
  if (!parsed) return { reason: 'unparsable_reference' }

  const abbreviation =
    passage.translationAbbreviation?.trim() ||
    translationSuffixOf(passage.reference)
  if (!abbreviation) return { reason: 'no_translation' }

  const translation = db
    .query<{ id: number }, [string]>(
      'SELECT id FROM bible_translations WHERE lower(abbreviation) = lower(?)',
    )
    .get(abbreviation)
  if (!translation) return { reason: 'unknown_translation' }

  const book = db
    .query<
      { id: number; book_code: string; book_name: string },
      [number, string, string]
    >(
      `SELECT id, book_code, book_name FROM bible_books
       WHERE translation_id = ? AND (lower(book_name) = lower(?) OR lower(book_code) = lower(?))`,
    )
    .get(translation.id, parsed.bookName, parsed.bookName)
  if (!book) return { reason: 'unknown_book' }

  const verses = db
    .query<
      { chapter: number; verse: number; text: string },
      [number, number, number, number, number, number, number]
    >(
      `SELECT chapter, verse, text FROM bible_verses
       WHERE book_id = ?
         AND (chapter > ? OR (chapter = ? AND verse >= ?))
         AND (chapter < ? OR (chapter = ? AND verse <= ?))
       ORDER BY chapter, verse`,
    )
    .all(
      book.id,
      parsed.startChapter,
      parsed.startChapter,
      parsed.startVerse,
      parsed.endChapter,
      parsed.endChapter,
      parsed.endVerse,
    )

  if (verses.length === 0) return { reason: 'verses_not_found' }

  const first = verses[0]
  const last = verses[verses.length - 1]
  if (!first || !last) return { reason: 'verses_not_found' }
  if (
    first.chapter !== parsed.startChapter ||
    first.verse !== parsed.startVerse ||
    last.chapter !== parsed.endChapter ||
    last.verse !== parsed.endVerse
  ) {
    return { reason: 'incomplete_range' }
  }

  return {
    entry: {
      personName: '',
      translationId: translation.id,
      bookCode: book.book_code,
      bookName: book.book_name,
      reference: formatPassageReference(
        book.book_name,
        parsed.startChapter,
        parsed.startVerse,
        parsed.endChapter,
        parsed.endVerse,
      ),
      text: verses.map((verse) => verse.text).join(' '),
      startChapter: parsed.startChapter,
      startVerse: parsed.startVerse,
      endChapter: parsed.endChapter,
      endVerse: parsed.endVerse,
    },
  }
}

/**
 * Converts a legacy `bible_passage` item into the single "Versete Biblice"
 * entry that now represents it.
 *
 * Used by the one-shot database migration and by every read path that can still
 * meet a `bible_passage` item in the wild (exported programs, cloud-synced
 * libraries), so all of them land on exactly the same shape.
 *
 * Never guesses: a passage it cannot resolve is reported with a reason so the
 * caller can leave the original data untouched.
 */
export function resolveLegacyBiblePassage(
  db: Database,
  passage: LegacyBiblePassage,
): LegacyBiblePassageResolution {
  const ordered = [...passage.verses].sort((a, b) => a.sortOrder - b.sortOrder)

  const fromVerseIds = resolveFromVerseIds(db, ordered)
  if (fromVerseIds)
    return { ok: true, entry: fromVerseIds, source: 'verse_ids' }

  const fromReference = resolveFromReference(db, passage)
  if ('entry' in fromReference) {
    return { ok: true, entry: fromReference.entry, source: 'reference' }
  }

  return { ok: false, reason: fromReference.reason }
}
