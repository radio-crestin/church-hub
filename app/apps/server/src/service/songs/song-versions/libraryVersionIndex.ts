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

// Each song's slides read through its own index entry, so a page of songs
// costs only its songs (a join materialised every slide of the library).
const SONG_ROWS_SQL = `SELECT s.id, s.category_id, s.title,
       COALESCE((SELECT GROUP_CONCAT(content, ' ')
                 FROM (SELECT content FROM song_slides
                       WHERE song_id = s.id ORDER BY sort_order)), '') AS lyrics
FROM songs s`

/** Songs indexed per step of the warm-up: a few tens of ms each. */
const WARMUP_SONGS_PER_STEP = 250

let cached: LibraryVersionIndex | null = null
/** Bumped by every change to the library, so a warm-up that read part of it before is dropped. */
let generation = 0

/** The index, built on first use (or at start-up) and kept up to date. */
export function getLibraryVersionIndex(): LibraryVersionIndex {
  if (!cached) {
    const start = performance.now()
    cached = buildLibraryVersionIndex()
    logBuilt(cached, start)
  }
  return cached
}

/**
 * Builds the index at start-up in short steps, letting the requests waiting
 * in between be answered: built in one go it held every request for seconds
 * on a large library, the projection's first slide included (T-139).
 */
export async function warmUpLibraryVersionIndex(): Promise<void> {
  const start = performance.now()
  const startGeneration = generation
  const stale = () => cached !== null || generation !== startGeneration
  const index = emptyIndex()
  const page = getRawDatabase().query(
    `${SONG_ROWS_SQL} WHERE s.id > ? ORDER BY s.id LIMIT ?`,
  )
  let lastId = 0
  for (;;) {
    if (stale()) return
    const rows = page.all(lastId, WARMUP_SONGS_PER_STEP) as SongRow[]
    for (const row of rows) addSong(index, row)
    const last = rows.at(-1)
    if (!last || rows.length < WARMUP_SONGS_PER_STEP) break
    lastId = last.id
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  if (stale()) return
  cached = index
  logBuilt(index, start)
}

/** Changes with every change to the library: what is derived from the index is stale once it moves. */
export function libraryIndexGeneration(): number {
  return generation
}

/** After the whole library changed: the next comparison rebuilds the index. */
export function resetLibraryVersionIndex(): void {
  generation++
  cached = null
}

/** A song was saved: the index holds its current title, lyrics and category. */
export function refreshLibrarySong(songId: number): void {
  generation++
  if (!cached) return
  removeLibrarySong(songId)
  const row = getRawDatabase()
    .query(`${SONG_ROWS_SQL} WHERE s.id = ?`)
    .get(songId) as SongRow | null
  if (row) addSong(cached, row)
}

/** A song was deleted: it no longer comes back as a version. */
export function removeLibrarySong(songId: number): void {
  generation++
  if (!cached) return
  const place = cached.placeOf.get(songId)
  if (place === undefined) return
  cached.songs[place] = null
  cached.placeOf.delete(songId)
}

function logBuilt(index: LibraryVersionIndex, start: number): void {
  logger.info(
    `Library version index: ${index.placeOf.size} songs, ${index.wordIds.size} words in ${(performance.now() - start).toFixed(0)}ms`,
  )
}

function emptyIndex(): LibraryVersionIndex {
  return {
    songs: [],
    placeOf: new Map(),
    wordIds: new Map(),
    titlePostings: [],
    lyricsPostings: [],
  }
}

function buildLibraryVersionIndex(): LibraryVersionIndex {
  const index = emptyIndex()
  const rows = getRawDatabase().query(SONG_ROWS_SQL).all() as SongRow[]
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
  // `assign` gave every id of the song its postings lists.
  for (const id of song.title.ids) index.titlePostings[id]!.push(place)
  for (const id of song.lyrics.ids) index.lyricsPostings[id]!.push(place)
}
