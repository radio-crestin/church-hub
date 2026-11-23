import { forEachInEither, forEachSongWord } from './forEachSongWord'
import { COMMON_WORD_SHARE, themeWordWeights } from './themeWordWeights'
import { getRawDatabase } from '../../../db'
import { getHiddenCategoryIds } from '../categories'
import { describeLibrarySongs } from '../song-versions/describeLibrarySongs'
import {
  getLibraryVersionIndex,
  type LibrarySong,
} from '../song-versions/libraryVersionIndex'
import {
  scoreVersionPair,
  VERSION_MIN_SCORE,
} from '../song-versions/scoreVersionPair'
import type { SameThemeSong } from '../types'

/** Below this cosine two songs share too little to be on one theme. */
const MIN_THEME_SCORE = 0.08

/**
 * The songs on the same theme as a song, best first: the songs that share the
 * rarest words of its title and lyrics (a TF-IDF cosine), as few songs have a
 * theme filled in. Songs with the same theme filled in come first. Versions of
 * the song (its group, or songs scoring as versions), more than one copy of a
 * song, and songs in a hidden category are left out.
 */
export function findSameThemeSongs(songId: number, limit = 8): SameThemeSong[] {
  const index = getLibraryVersionIndex()
  const place = index.placeOf.get(songId)
  const subject = place === undefined ? null : index.songs[place]
  if (!subject) return []

  const excluded = new Set(groupMemberIds(songId))
  const hidden = new Set(getHiddenCategoryIds())
  const allowed = (song: LibrarySong | null): song is LibrarySong =>
    !!song &&
    !excluded.has(song.id) &&
    (song.categoryId === null || !hidden.has(song.categoryId))
  // One row per song: a copy of the song itself, or of a song already
  // listed, is a version, not another song on the theme.
  const picked: LibrarySong[] = [subject]
  const pick = (song: LibrarySong) => {
    const isCopy = picked.some(
      (other) => scoreVersionPair(other, song).score >= VERSION_MIN_SCORE,
    )
    if (!isCopy) picked.push(song)
    return !isCopy
  }

  const sameThemeField = songsWithSameThemeField(songId)
    .map((id) => index.songs[index.placeOf.get(id) ?? -1] ?? null)
    .filter(allowed)
    .filter(pick)
    .slice(0, limit)
  for (const song of sameThemeField) excluded.add(song.id)

  const { weight, songCount, songTotal } = themeWordWeights(index)
  const songNorm = (song: LibrarySong) => {
    let sum = 0
    forEachSongWord(song, (id) => {
      sum += weight[id]
    })
    return Math.sqrt(sum)
  }

  const shared = new Map<number, number>()
  forEachSongWord(subject, (id) => {
    if (!weight[id] || songCount[id] > songTotal * COMMON_WORD_SHARE) return
    forEachInEither(index.titlePostings[id], index.lyricsPostings[id], (at) => {
      shared.set(at, (shared.get(at) ?? 0) + weight[id])
    })
  })

  const subjectNorm = songNorm(subject)
  const ranked: Array<{ song: LibrarySong; score: number }> = []
  for (const [at, dot] of shared) {
    const song = index.songs[at]
    if (!allowed(song)) continue
    const score = dot / (subjectNorm * songNorm(song))
    if (score >= MIN_THEME_SCORE) ranked.push({ song, score })
  }
  ranked.sort((a, b) => b.score - a.score || a.song.id - b.song.id)

  const found = sameThemeField.map((song) => ({ songId: song.id, score: 1 }))
  for (const { song, score } of ranked) {
    if (found.length >= limit) break
    if (pick(song)) {
      found.push({ songId: song.id, score: Math.round(score * 100) / 100 })
    }
  }
  return describeLibrarySongs(found)
}

/** The song and the songs linked to it as versions. */
function groupMemberIds(songId: number): number[] {
  const rows = getRawDatabase()
    .query(
      `SELECT id FROM songs WHERE id = ?1 OR song_group_id =
         (SELECT song_group_id FROM songs WHERE id = ?1)`,
    )
    .all(songId) as Array<{ id: number }>
  return rows.map((row) => row.id)
}

/** The songs whose filled-in theme is the song's own. */
function songsWithSameThemeField(songId: number): number[] {
  const rows = getRawDatabase()
    .query(
      `SELECT other.id FROM songs subject JOIN songs other
         ON lower(trim(other.theme)) = lower(trim(subject.theme))
       WHERE subject.id = ? AND trim(coalesce(subject.theme, '')) <> ''
         AND other.id <> subject.id
       ORDER BY other.presentation_count DESC, other.id`,
    )
    .all(songId) as Array<{ id: number }>
  return rows.map((row) => row.id)
}
