import { idByUuid } from './idByUuid'
import { getRawDatabase } from '../../../db'
import type { LibraryBibleBookmark } from '../types'

export function serializeBibleBookmarks(): LibraryBibleBookmark[] {
  return getRawDatabase()
    .query<LibraryBibleBookmark, []>(
      `SELECT uuid, translation_abbreviation AS translationAbbreviation,
              book_code AS bookCode, book_name AS bookName, chapter, verse,
              reference, text, markdown, sort_order AS sortOrder,
              created_at AS createdAt, updated_at AS updatedAt
         FROM bible_bookmarks WHERE uuid != ''`,
    )
    .all()
}

/**
 * This device's ids of a bookmarked verse, found by translation, book and
 * chapter:verse. 0 for what it hasn't downloaded: the bookmark keeps its
 * own reference and text, so it still shows.
 */
function localVerse(bookmark: LibraryBibleBookmark) {
  const row = getRawDatabase()
    .query<
      { translation_id: number; book_id: number; verse_id: number | null },
      [string, string, number, number]
    >(
      `SELECT t.id AS translation_id, b.id AS book_id, v.id AS verse_id
         FROM bible_translations t
         JOIN bible_books b ON b.translation_id = t.id AND b.book_code = ?2
         LEFT JOIN bible_verses v
           ON v.book_id = b.id AND v.chapter = ?3 AND v.verse = ?4
        WHERE t.abbreviation = ?1`,
    )
    .get(
      bookmark.translationAbbreviation,
      bookmark.bookCode,
      bookmark.chapter,
      bookmark.verse,
    )
  return {
    translationId: row?.translation_id ?? 0,
    bookId: row?.book_id ?? 0,
    verseId: row?.verse_id ?? 0,
  }
}

export function upsertBibleBookmark(
  bookmark: LibraryBibleBookmark,
): number | null {
  const { translationId, bookId, verseId } = localVerse(bookmark)
  getRawDatabase()
    .query(
      `INSERT INTO bible_bookmarks (
         uuid, verse_id, reference, text, translation_abbreviation, book_name,
         book_code, translation_id, book_id, chapter, verse, sort_order,
         markdown, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (uuid) DO UPDATE SET
         verse_id = excluded.verse_id, reference = excluded.reference,
         text = excluded.text,
         translation_abbreviation = excluded.translation_abbreviation,
         book_name = excluded.book_name, book_code = excluded.book_code,
         translation_id = excluded.translation_id, book_id = excluded.book_id,
         chapter = excluded.chapter, verse = excluded.verse,
         sort_order = excluded.sort_order, markdown = excluded.markdown,
         updated_at = excluded.updated_at`,
    )
    .run(
      bookmark.uuid,
      verseId,
      bookmark.reference,
      bookmark.text,
      bookmark.translationAbbreviation,
      bookmark.bookName,
      bookmark.bookCode,
      translationId,
      bookId,
      bookmark.chapter,
      bookmark.verse,
      bookmark.sortOrder,
      bookmark.markdown,
      bookmark.createdAt,
      bookmark.updatedAt,
    )
  return idByUuid('bible_bookmarks', bookmark.uuid)
}
