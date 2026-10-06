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
 * A saved song takes a new place and its old one is emptied (null), so a
 * posting may point at an empty place.
 */
export interface LibraryVersionIndex {
  songs: Array<LibrarySong | null>
  placeOf: Map<number, number>
  wordIds: Map<string, number>
  /** Word id → places in `songs` whose title holds it. */
  titlePostings: number[][]
  /** Word id → places in `songs` whose lyrics hold it. */
  lyricsPostings: number[][]
}

interface SongRow {
  id: number
  category_id: number | null
  title: string
  lyrics: string
}

const SONG_ROWS_SQL = `SELECT s.id, s.category_id, s.title,
       COALESCE(GROUP_CONCAT(ss.content, ' '), '') AS lyrics
FROM songs s
LEFT JOIN (SELECT song_id, content FROM song_slides ORDER BY sort_order) ss
  ON ss.song_id = s.id`

let cached: LibraryVersionIndex | null = null

/** The index, built on first use (or at start-up) and kept up to date. */
export function getLibraryVersionIndex(): LibraryVersionIndex {
  if (!cached) {
    const start = performance.now()
    cached = buildLibraryVersionIndex()
    logger.info(
      `Library version index: ${cached.placeOf.size} songs, ${cached.wordIds.size} words in ${(performance.now() - start).toFixed(0)}ms`,
    )
  }
  return cached
}

/** After the whole library changed: the next comparison rebuilds the index. */
export function resetLibraryVersionIndex(): void {
  cached = null
}

/** A song was saved: the index holds its current title, lyrics and category. */
export function refreshLibrarySong(songId: number): void {
  if (!cached) return
  removeLibrarySong(songId)
  const row = getRawDatabase()
    .query(`${SONG_ROWS_SQL} WHERE s.id = ? GROUP BY s.id`)
    .get(songId) as SongRow | null
  if (row) addSong(cached, row)
}

/** A song was deleted: it no longer comes back as a version. */
export function removeLibrarySong(songId: number): void {
  if (!cached) return
  const place = cached.placeOf.get(songId)
  if (place === undefined) return
  cached.songs[place] = null
  cached.placeOf.delete(songId)
}

function buildLibraryVersionIndex(): LibraryVersionIndex {
  const index: LibraryVersionIndex = {
    songs: [],
    placeOf: new Map(),
    wordIds: new Map(),
    titlePostings: [],
    lyricsPostings: [],
  }
  const rows = getRawDatabase()
    .query(`${SONG_ROWS_SQL} GROUP BY s.id`)
    .all() as SongRow[]
  for (const row of rows) addSong(index, row)
  return index
}

function addSong(index: LibraryVersionIndex, row: SongRow): void {
  const assign = (word: string) => {
    let id = index.wordIds.get(word)
    if (id === undefined) {
      id = index.wordIds.size
      index.wordIds.set(word, id)
      index.titlePostings.push([])
      index.lyricsPostings.push([])
    }
    return id
  }
  const song: LibrarySong = {
    id: row.id,
    categoryId: row.category_id,
    title: toWordSet(contentWords(tokenize(row.title)), assign),
    lyrics: toWordSet(contentWords(lyricsTokens(row.lyrics)), assign),
  }
  const place = index.songs.length
  index.songs.push(song)
  index.placeOf.set(song.id, place)
  for (const id of song.title.ids) index.titlePostings[id].push(place)
  for (const id of song.lyrics.ids) index.lyricsPostings[id].push(place)
}
