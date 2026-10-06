import { contentWords, lyricsTokens, tokenize } from './versionWords'
import { toWordSet, type WordSet } from './wordSet'
import { getRawDatabase } from '../../../db'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('song-versions')

export interface LibrarySong {
  id: number
  categoryId: number | null
  /** The distinctive words of the title and of the lyrics. */
  title: WordSet
  lyrics: WordSet
}

/**
 * The library's songs as word sets, with, for each word, the songs whose
 * title or lyrics hold it: comparing a song with the whole library is then
 * a walk over the songs that share its words, not a query per song.
 */
export interface LibraryVersionIndex {
  songs: LibrarySong[]
  wordIds: Map<string, number>
  /** Word id → positions in `songs` whose title holds it. */
  titlePostings: Int32Array[]
  /** Word id → positions in `songs` whose lyrics hold it. */
  lyricsPostings: Int32Array[]
}

let cached: LibraryVersionIndex | null = null

/** The index, built on first use and kept until the songs change. */
export function getLibraryVersionIndex(): LibraryVersionIndex {
  if (!cached) {
    const start = performance.now()
    cached = buildLibraryVersionIndex()
    logger.info(
      `Library version index: ${cached.songs.length} songs, ${cached.wordIds.size} words in ${(performance.now() - start).toFixed(0)}ms`,
    )
  }
  return cached
}

/** Drops the index after songs change; the next comparison rebuilds it. */
export function resetLibraryVersionIndex(): void {
  cached = null
}

function buildLibraryVersionIndex(): LibraryVersionIndex {
  const rows = getRawDatabase()
    .query(
      `SELECT s.id, s.category_id, s.title,
              COALESCE(GROUP_CONCAT(ss.content, ' '), '') AS lyrics
       FROM songs s
       LEFT JOIN (SELECT song_id, content FROM song_slides ORDER BY sort_order) ss
         ON ss.song_id = s.id
       GROUP BY s.id`,
    )
    .all() as Array<{
    id: number
    category_id: number | null
    title: string
    lyrics: string
  }>

  const wordIds = new Map<string, number>()
  const assign = (word: string) => {
    let id = wordIds.get(word)
    if (id === undefined) {
      id = wordIds.size
      wordIds.set(word, id)
    }
    return id
  }
  const songs = rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    title: toWordSet(contentWords(tokenize(row.title)), assign),
    lyrics: toWordSet(contentWords(lyricsTokens(row.lyrics)), assign),
  }))

  return {
    songs,
    wordIds,
    titlePostings: buildPostings(songs, wordIds.size, (song) => song.title),
    lyricsPostings: buildPostings(songs, wordIds.size, (song) => song.lyrics),
  }
}

function buildPostings(
  songs: LibrarySong[],
  wordCount: number,
  setOf: (song: LibrarySong) => WordSet,
): Int32Array[] {
  const counts = new Int32Array(wordCount)
  for (const song of songs) for (const id of setOf(song).ids) counts[id]++
  const postings = Array.from(
    { length: wordCount },
    (_, id) => new Int32Array(counts[id]),
  )
  const filled = new Int32Array(wordCount)
  songs.forEach((song, position) => {
    for (const id of setOf(song).ids) postings[id][filled[id]++] = position
  })
  return postings
}
