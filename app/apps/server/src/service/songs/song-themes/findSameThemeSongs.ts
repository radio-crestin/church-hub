import { getLibraryThemeIndex } from './libraryThemeIndex'
import type { ThemeId } from './themeLexicon'
import { themeStem } from './themeStem'
import { getRawDatabase } from '../../../db'
import { decodeHtmlEntities } from '../../text-search/text/decodeHtmlEntities'
import { getHiddenCategoryIds } from '../categories'
import { describeSuggestedSongs } from '../describeSuggestedSongs'
import { getLibraryVersionIndex } from '../song-versions/libraryVersionIndex'
import { scoreVersionPair } from '../song-versions/scoreVersionPair'
import { tokenize } from '../song-versions/versionWords'
import type { SongThemeSuggestion } from '../types'

/** Fewer shared stems than this is a coincidence, not a theme (unless both are on a named one). */
const MIN_SHARED_STEMS = 3
/** Below this the songs share words, not a subject. */
const MIN_SCORE = 0.08
/** At or above this a song is a version (see `getSimilarSongs`), not another song. */
const VERSION_SCORE = 0.55
const SHARED_WORDS_SHOWN = 4
/** Each named theme both songs are on adds this to their score. */
const SHARED_THEME_BONUS = 0.1

/**
 * Other songs on the same theme as a song, closest first: the cosine of
 * their weighted stems (see `LibraryThemeIndex`), each with the words that
 * made the match. Versions of the song (its group, and those `Versiuni`
 * suggests) and songs in hidden categories never come back.
 */
export function findSameThemeSongs(
  songId: number,
  limit = 8,
): SongThemeSuggestion[] {
  const versions = getLibraryVersionIndex()
  const themes = getLibraryThemeIndex()
  const place = versions.placeOf.get(songId)
  const subject = place === undefined ? null : versions.songs[place]
  const subjectStems = place === undefined ? null : themes.songStems[place]
  if (place === undefined || !subject || !subjectStems) return []

  const sharedWeight = new Float64Array(versions.songs.length)
  const sharedCount = new Int32Array(versions.songs.length)
  for (const stem of subjectStems) {
    const weight = themes.weight[stem] ** 2
    for (const other of themes.stemPostings[stem]) {
      sharedWeight[other] += weight
      sharedCount[other]++
    }
  }

  const excluded = groupMemberIds(songId)
  const hidden = new Set(getHiddenCategoryIds())
  const subjectThemes = themes.songThemes[place] ?? []
  const scored: Array<{
    songId: number
    score: number
    place: number
    themes: ThemeId[]
  }> = []
  sharedCount.forEach((count, other) => {
    if (count === 0 || other === place) return
    const song = versions.songs[other]
    if (!song || excluded.has(song.id)) return
    if (song.categoryId !== null && hidden.has(song.categoryId)) return
    const shared = sharedThemes(subjectThemes, themes.songThemes[other])
    const cosine =
      sharedWeight[other] / (themes.norm[place] * themes.norm[other])
    const sharesWords = count >= MIN_SHARED_STEMS && cosine >= MIN_SCORE
    if (!sharesWords && shared.length === 0) return
    if (scoreVersionPair(subject, song).score >= VERSION_SCORE) return
    const score = cosine + SHARED_THEME_BONUS * shared.length
    scored.push({ songId: song.id, score, place: other, themes: shared })
  })
  scored.sort((a, b) => b.score - a.score || a.songId - b.songId)

  const wordOf = subjectWordsByStem(songId)
  const stemNames = [...themes.stemIds.keys()]
  return describeSuggestedSongs(
    scored.slice(0, limit).map((found) => ({
      songId: found.songId,
      score: Math.round(Math.min(1, found.score) * 100) / 100,
      themes: found.themes,
      sharedWords: sharedStems(subjectStems, themes.songStems[found.place])
        .sort((a, b) => themes.weight[b] - themes.weight[a])
        .slice(0, SHARED_WORDS_SHOWN)
        .map((stem) => wordOf.get(stemNames[stem]) ?? stemNames[stem]),
    })),
  )
}

function groupMemberIds(songId: number): Set<number> {
  const rows = getRawDatabase()
    .query(
      `SELECT id FROM songs WHERE song_group_id IS NOT NULL
         AND song_group_id = (SELECT song_group_id FROM songs WHERE id = ?)`,
    )
    .all(songId) as Array<{ id: number }>
  return new Set(rows.map((row) => row.id))
}

function sharedThemes(a: ThemeId[], b: ThemeId[] | null): ThemeId[] {
  return a.filter((theme) => b?.includes(theme))
}

function sharedStems(a: Int32Array, b: Int32Array | null): number[] {
  if (!b) return []
  const inB = new Set(b)
  return [...a].filter((stem) => inB.has(stem))
}

/** Each stem of the song's words, as the song first writes it (diacritics kept). */
function subjectWordsByStem(songId: number): Map<string, string> {
  const row = getRawDatabase()
    .query(
      `SELECT s.title || ' ' || COALESCE((SELECT GROUP_CONCAT(content, ' ')
         FROM (SELECT content FROM song_slides WHERE song_id = s.id
               ORDER BY sort_order)), '') AS text
       FROM songs s WHERE s.id = ?`,
    )
    .get(songId) as { text: string } | null
  const words = new Map<string, string>()
  const text = decodeHtmlEntities(
    (row?.text ?? '').replace(/<[^>]+>/g, ' '),
  ).toLowerCase()
  for (const word of text.normalize('NFC').split(/[^\p{L}\p{M}\p{N}]+/u)) {
    const [folded] = tokenize(word)
    if (!folded) continue
    const stem = themeStem(folded)
    if (!words.has(stem)) words.set(stem, word)
  }
  return words
}
