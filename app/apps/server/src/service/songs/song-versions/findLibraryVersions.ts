import { getLibraryVersionIndex } from './libraryVersionIndex'
import {
  LYRICS_MATCH_THRESHOLD,
  MIN_LYRICS_CONTENT_WORDS,
  scoreVersionPair,
  type VersionWords,
} from './scoreVersionPair'
import { contentWords, lyricsTokens, tokenize } from './versionWords'
import { toWordSet, wordSetSize } from './wordSet'
import { getRawDatabase } from '../../../db'
import { getHiddenCategoryIds } from '../categories'
import type { SongVersionSuggestion } from '../types'

export interface FindLibraryVersionsOptions {
  limit?: number
  minScore?: number
  excludeSongIds?: readonly number[]
}

/**
 * The library songs most likely to be versions of a song given by its title
 * and lyrics (slide HTML), best first (see `scoreVersionPair`). Every song
 * that could reach `minScore` is considered: those sharing a distinctive
 * title word, and those holding enough of its lyrics to be a re-titled
 * version. Songs in a hidden category never come back.
 */
export function findLibraryVersions(
  title: string,
  lyrics: string,
  {
    limit = 5,
    minScore = 0.55,
    excludeSongIds = [],
  }: FindLibraryVersionsOptions = {},
): SongVersionSuggestion[] {
  const index = getLibraryVersionIndex()
  const idOf = (word: string) => index.wordIds.get(word) ?? null
  const subject: VersionWords = {
    title: toWordSet(contentWords(tokenize(title)), idOf),
    lyrics: toWordSet(contentWords(lyricsTokens(lyrics)), idOf),
  }
  const hidden = new Set(getHiddenCategoryIds())
  const excluded = new Set(excludeSongIds)

  const scored: Array<
    Pick<SongVersionSuggestion, 'songId' | 'score' | 'reason'>
  > = []
  for (const place of candidatePlaces(subject)) {
    const song = index.songs[place]
    if (!song || excluded.has(song.id)) continue
    if (song.categoryId !== null && hidden.has(song.categoryId)) continue
    const { score, reason } = scoreVersionPair(subject, song)
    if (score >= minScore) scored.push({ songId: song.id, score, reason })
  }
  scored.sort((a, b) => b.score - a.score || a.songId - b.songId)
  return describeSongs(
    scored.slice(0, limit).map((song) => ({
      ...song,
      score: Math.round(song.score * 100) / 100,
    })),
  )
}

/**
 * The library songs that could score at all: a shared distinctive title
 * word, or lyrics sharing at least `LYRICS_MATCH_THRESHOLD` of the subject's
 * words (a Jaccard that high needs at least that many shared words).
 */
function candidatePlaces(subject: VersionWords): Set<number> {
  const { songs, titlePostings, lyricsPostings } = getLibraryVersionIndex()
  const places = new Set<number>()
  for (const id of subject.title.ids) {
    for (const place of titlePostings[id]) places.add(place)
  }

  const lyricsSize = wordSetSize(subject.lyrics)
  if (lyricsSize < MIN_LYRICS_CONTENT_WORDS) return places
  const needed = Math.ceil(LYRICS_MATCH_THRESHOLD * lyricsSize - 1e-9)
  if (needed > subject.lyrics.ids.length) return places
  const shared = new Int32Array(songs.length)
  for (const id of subject.lyrics.ids) {
    for (const place of lyricsPostings[id]) {
      if (++shared[place] === needed) places.add(place)
    }
  }
  return places
}

/** The scored songs with what the version list shows for each. */
function describeSongs(
  found: Array<Pick<SongVersionSuggestion, 'songId' | 'score' | 'reason'>>,
): SongVersionSuggestion[] {
  if (found.length === 0) return []
  const rows = getRawDatabase()
    .query(
      `SELECT s.id, s.title, s.hymn_number, s.author, s.key_line,
              sc.name AS category_name
       FROM songs s LEFT JOIN song_categories sc ON sc.id = s.category_id
       WHERE s.id IN (${found.map(() => '?').join(',')})`,
    )
    .all(...found.map((song) => song.songId)) as Array<{
    id: number
    title: string
    hymn_number: string | null
    author: string | null
    key_line: string | null
    category_name: string | null
  }>
  const byId = new Map(rows.map((row) => [row.id, row]))
  return found.flatMap((song) => {
    const row = byId.get(song.songId)
    if (!row) return []
    return [
      {
        ...song,
        title: row.title,
        hymnNumber: row.hymn_number,
        author: row.author,
        categoryName: row.category_name,
        keyLine: row.key_line,
      },
    ]
  })
}
