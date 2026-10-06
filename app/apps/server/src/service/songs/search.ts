import { joinSearchTitles } from './parseAlternateTitles'
import { SONGS_FTS_TABLE } from './song-search/fetchSongCandidates'
import { songSearchCache } from './song-search/songSearchCache'
import {
  getLibraryVersionIndex,
  refreshLibrarySong,
  removeLibrarySong,
  resetLibraryVersionIndex,
} from './song-versions/libraryVersionIndex'
import { getRawDatabase } from '../../db'
import { createLogger } from '../../utils/logger'
import { decodeHtmlEntities } from '../text-search/text/decodeHtmlEntities'
import { joinedWordVariants } from '../text-search/text/joinedWordVariants'
import {
  addVocabularyWords,
  getVocabulary,
  resetVocabulary,
} from '../text-search/vocabularyStore'

const logger = createLogger('song-search')

/**
 * Clears the search results cache (call when index is updated)
 */
export function clearSearchCache(): void {
  songSearchCache.clear()
  logger.debug('Search cache cleared')
}

/**
 * Normalizes text by removing diacritics (accents)
 * e.g., "în" -> "in", "ă" -> "a", "ș" -> "s"
 */
function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Normalizes text for FTS indexing:
 * - Decodes HTML entities (slide content is stored escaped, so an apostrophe
 *   arrives as `&#039;` and would otherwise tokenise into a stray "039")
 * - Replaces punctuation with spaces (so "să-nfăptuiesc" becomes "să nfăptuiesc")
 * - Adds the joined spellings of hyphen/apostrophe words, so "ne-ncetat",
 *   "ne'ncetat", "nencetat" and "neîncetat" all find each other
 * - Expands Romanian contractions (n- prefix) for better searchability
 * - Diacritics are handled by the FTS5 tokenizer (remove_diacritics 2)
 *
 * Romanian linguistic patterns handled:
 * - "să-nfăptuiesc" → "sa nfaptuiesc faptuiesc … sanfaptuiesc sainfaptuiesc"
 * - "ne-ncetat" → "ne ncetat cetat … nencetat neincetat"
 * - "n-am" → "n am am" (expands contraction; too short to join)
 * - "s-a" → "s a" (reflexive pronoun contraction)
 */
export function normalizeForIndex(text: string): string {
  const plain = removeDiacritics(
    decodeHtmlEntities(text.replace(/<[^>]+>/g, ' ')),
  )

  // Joined spellings are appended after the text rather than inserted next
  // to their word, so the phrase order of the original stays intact for
  // phrase queries and phrase scoring.
  const words: string[] = []
  const joined: string[] = []
  for (const token of plain.split(/\s+/)) {
    // Replace ALL punctuation (commas, hyphens, periods, etc.) with spaces
    const pieces = token
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .split(' ')
      .filter((piece) => piece.length > 0)
    words.push(...pieces)
    if (pieces.length > 1) {
      joined.push(...joinedWordVariants(token.toLowerCase()))
    }
  }

  // Expand Romanian n- contractions: words starting with "n" followed by consonant
  // are often contractions of "în" + word (e.g., "nfaptuiesc" = "infaptuiesc" → also index "faptuiesc")
  const expandedWords: string[] = []

  for (const word of words) {
    expandedWords.push(word)
    if (
      word.length > 2 &&
      word[0].toLowerCase() === 'n' &&
      !/^n[aeiou]/i.test(word)
    ) {
      expandedWords.push(word.substring(1))
    }
  }

  // Single-character tokens stay in the index. They are linguistically
  // meaningful — the Romanian clitic contractions split into them at
  // tokenization ("m-a" → "m a") and a user typing the exact title needs
  // those tokens to land an exact phrase match in FTS.
  return [...expandedWords, ...joined].join(' ')
}

/** Updates the FTS index for a specific song. */
export function updateSearchIndex(songId: number): void {
  try {
    logger.debug(`Updating search index for song: ${songId}`)

    const db = getRawDatabase()

    // Get song title and category name
    const songQuery = db.query(`
      SELECT s.title, s.alternate_titles, sc.name as category_name
      FROM songs s
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE s.id = ?
    `)
    const song = songQuery.get(songId) as {
      title: string
      alternate_titles: string | null
      category_name: string | null
    } | null

    if (!song) {
      logger.debug(`Song not found for indexing: ${songId}`)
      return
    }

    // Get all slide content for this song
    const slidesQuery = db.query(
      'SELECT content FROM song_slides WHERE song_id = ? ORDER BY sort_order ASC',
    )
    const slides = slidesQuery.all(songId) as { content: string }[]
    const combinedContent = slides.map((s) => s.content).join(' ')

    // Normalize text for indexing (replace hyphens with spaces for better matching)
    const normalizedTitle = normalizeForIndex(
      joinSearchTitles(song.title, song.alternate_titles),
    )
    const normalizedCategory = normalizeForIndex(song.category_name ?? '')
    const normalizedContent = normalizeForIndex(combinedContent)

    // Update standard FTS index
    db.query('DELETE FROM songs_fts WHERE song_id = ?').run(songId)
    db.query(`
      INSERT INTO songs_fts (song_id, title, category_name, content)
      VALUES (?, ?, ?, ?)
    `).run(songId, normalizedTitle, normalizedCategory, normalizedContent)

    // A song saved a moment ago is found with a typo straight away.
    addVocabularyWords(
      SONGS_FTS_TABLE,
      indexedWords(
        `${normalizedTitle} ${normalizedCategory} ${normalizedContent}`,
      ),
    )
    // …and compared as a version with what it says now.
    refreshLibrarySong(songId)

    // The result cache holds whole result sets keyed by query, so an edited
    // title stays unfindable for the cache's lifetime unless it is dropped.
    clearSearchCache()

    logger.debug(`Search index updated for song: ${songId}`)
  } catch (error) {
    logger.error(`Failed to update search index: ${error}`)
  }
}

/** Removes a song from the FTS index. */
export function removeFromSearchIndex(songId: number): void {
  try {
    logger.debug(`Removing song from search index: ${songId}`)

    const db = getRawDatabase()
    db.query('DELETE FROM songs_fts WHERE song_id = ?').run(songId)
    removeLibrarySong(songId)

    // Otherwise a deleted song keeps showing up in cached result sets.
    clearSearchCache()

    logger.debug(`Song removed from search index: ${songId}`)
  } catch (error) {
    logger.error(`Failed to remove from search index: ${error}`)
  }
}

/**
 * Updates the FTS index for all songs in a category
 * Called when a category name is updated
 */
export function updateSearchIndexByCategory(categoryId: number): void {
  try {
    logger.debug(`Updating search index for category: ${categoryId}`)

    const db = getRawDatabase()
    const songsQuery = db.query('SELECT id FROM songs WHERE category_id = ?')
    const songs = songsQuery.all(categoryId) as { id: number }[]

    for (const song of songs) {
      updateSearchIndex(song.id)
    }

    logger.debug(`Updated ${songs.length} songs for category: ${categoryId}`)
  } catch (error) {
    logger.error(`Failed to update search index for category: ${error}`)
  }
}

/**
 * Batch updates the FTS index for multiple songs in a single transaction
 * Uses JavaScript normalization to properly expand Romanian contractions
 */
export function batchUpdateSearchIndex(songIds: number[]): void {
  if (songIds.length === 0) return

  try {
    const totalStart = performance.now()
    logger.info(`Batch updating search index for ${songIds.length} songs`)

    const db = getRawDatabase()

    // Build placeholders for IN clause
    const placeholders = songIds.map(() => '?').join(',')

    // Fetch songs data
    const songs = db
      .query(
        `
      SELECT
        s.id,
        s.title,
        s.alternate_titles,
        COALESCE(sc.name, '') as category_name,
        COALESCE(GROUP_CONCAT(ss.content, ' '), '') as content
      FROM songs s
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      LEFT JOIN (
        SELECT song_id, content FROM song_slides ORDER BY sort_order
      ) ss ON ss.song_id = s.id
      WHERE s.id IN (${placeholders})
      GROUP BY s.id
    `,
      )
      .all(...songIds) as Array<{
      id: number
      title: string
      alternate_titles: string | null
      category_name: string
      content: string
    }>

    db.run('BEGIN TRANSACTION')

    try {
      // Delete existing FTS entries for these songs
      const deleteStart = performance.now()
      db.query(`DELETE FROM songs_fts WHERE song_id IN (${placeholders})`).run(
        ...songIds,
      )
      const deleteTime = performance.now() - deleteStart

      // Prepare insert statements
      const ftsInsert = db.prepare(`
        INSERT INTO songs_fts (song_id, title, category_name, content)
        VALUES (?, ?, ?, ?)
      `)

      // Insert each song with normalized content
      const ftsStart = performance.now()
      for (const song of songs) {
        const normalizedTitle = normalizeForIndex(
          joinSearchTitles(song.title, song.alternate_titles),
        )
        const normalizedCategory = normalizeForIndex(song.category_name)
        const normalizedContent = normalizeForIndex(song.content)

        ftsInsert.run(
          song.id,
          normalizedTitle,
          normalizedCategory,
          normalizedContent,
        )
      }
      const ftsTime = performance.now() - ftsStart

      db.run('COMMIT')
      const totalTime = performance.now() - totalStart

      // Clear the search cache and vocabulary since the index changed
      clearSearchCache()
      resetVocabulary(SONGS_FTS_TABLE)
      for (const songId of songIds) refreshLibrarySong(songId)

      logger.info(
        `[PERF] Search index update: ${totalTime.toFixed(2)}ms | Delete: ${deleteTime.toFixed(0)}ms | FTS: ${ftsTime.toFixed(0)}ms`,
      )
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
  } catch (error) {
    logger.error(`Failed to batch update search index: ${error}`)
  }
}

/**
 * Warms up the songs FTS index by loading its vocabulary (the typo lookup),
 * which reads the whole index into the OS page cache on the way, and the
 * library version index, so the first "possible versions" is instant.
 */
export function warmupSearchIndex(): void {
  const startTime = performance.now()
  try {
    getVocabulary(SONGS_FTS_TABLE)
    getLibraryVersionIndex()
  } catch (error) {
    logger.warning(`FTS warmup skipped: ${error}`)
  }
  const elapsed = performance.now() - startTime
  logger.info(`FTS index warmup completed in ${elapsed.toFixed(1)}ms`)
}

const PROGRESS_EVERY_SONGS = 1000

/**
 * Rebuilds the entire search index
 * Uses JavaScript normalization to properly expand Romanian contractions
 * and handle hyphenated words for better searchability.
 * `onProgress` hears songs indexed of all songs (the start-up loading page).
 */
export function rebuildSearchIndex(
  onProgress?: (done: number, total: number) => void,
): void {
  try {
    logger.info('Rebuilding search index...')

    const db = getRawDatabase()

    // Fetch all songs with their content
    const songs = db
      .query(
        `
      SELECT
        s.id,
        s.title,
        s.alternate_titles,
        COALESCE(sc.name, '') as category_name,
        COALESCE(GROUP_CONCAT(ss.content, ' '), '') as content
      FROM songs s
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      LEFT JOIN (
        SELECT song_id, content FROM song_slides ORDER BY sort_order
      ) ss ON ss.song_id = s.id
      GROUP BY s.id
    `,
      )
      .all() as Array<{
      id: number
      title: string
      alternate_titles: string | null
      category_name: string
      content: string
    }>

    logger.info(`Found ${songs.length} songs to index`)

    // Use a transaction for atomicity
    db.run('BEGIN TRANSACTION')

    try {
      // Clear existing indexes
      db.run('DELETE FROM songs_fts')

      // Prepare insert statements
      const ftsInsert = db.prepare(`
        INSERT INTO songs_fts (song_id, title, category_name, content)
        VALUES (?, ?, ?, ?)
      `)

      // Insert each song with normalized content
      onProgress?.(0, songs.length)
      for (const [index, song] of songs.entries()) {
        if (index % PROGRESS_EVERY_SONGS === 0)
          onProgress?.(index, songs.length)
        const normalizedTitle = normalizeForIndex(
          joinSearchTitles(song.title, song.alternate_titles),
        )
        const normalizedCategory = normalizeForIndex(song.category_name)
        const normalizedContent = normalizeForIndex(song.content)

        ftsInsert.run(
          song.id,
          normalizedTitle,
          normalizedCategory,
          normalizedContent,
        )
      }

      db.run('COMMIT')
      onProgress?.(songs.length, songs.length)

      // Clear the search cache and vocabulary since the index changed
      clearSearchCache()
      resetVocabulary(SONGS_FTS_TABLE)
      resetLibraryVersionIndex()

      logger.info(`Search index rebuilt: ${songs.length} songs indexed`)
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
  } catch (error) {
    logger.error(`Failed to rebuild search index: ${error}`)
  }
}

/** The words the FTS tokenizer stores for an indexed text. */
function indexedWords(normalizedText: string): string[] {
  return normalizedText
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)
}
