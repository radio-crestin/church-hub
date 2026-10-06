import type { SongCandidate } from './fetchSongCandidates'
import type { TextQuery } from '../../text-search/prepareTextQuery'
import { decodeHtmlEntities } from '../../text-search/text/decodeHtmlEntities'
import type { TextMatchScore } from '../../text-search/types'
import { parseAlternateTitles } from '../parseAlternateTitles'

/**
 * Title matches are a different class of result from lyric matches: an
 * operator typing a title wants that song, not every song that sings the
 * words. A title scoring this well lands in a band above every lyric-only
 * match; the boosts below only reorder songs inside their band. The offset
 * clears the most a lyric match can reach with every boost (100 × 1.15 ×
 * 1.1 ≈ 127).
 */
const TITLE_MATCH_THRESHOLD = 50
const TITLE_BAND_OFFSET = 200
/** A title that holds the query somewhere other than its start. */
const NOT_AT_START_PENALTY = 5
/** A name spelled exactly as typed beats one that matches another spelling. */
const EXACT_SPELLING_BONUS = 2
const KEY_LINE_BOOST = 0.15
/** Up to 10% for songs presented often: log10(1 + n) / log10(101) × 0.1. */
const PRESENTATION_BOOST_SCALE = 0.1
const PRESENTATION_BOOST_DENOM = Math.log10(101)

export interface RankedSong {
  song: SongCandidate
  lyrics: string
  /** The words of the title and lyrics that matched, for the highlights. */
  matchedForms: string[]
  titleScore: number
  termScore: number
  boostedScore: number
}

/**
 * Scores every candidate on its titles and lyrics with the shared scorer
 * and orders them: best match first, category priority only between equally
 * good matches, then BM25.
 */
export function rankSongs(
  candidates: SongCandidate[],
  lyricsById: Map<number, string>,
  textQuery: TextQuery,
): RankedSong[] {
  const typedPhrase = textQuery.groups
    .map((group) => foldForScore(group.typed))
    .join(' ')
  return candidates
    .map((song) => {
      const lyrics = plainText(lyricsById.get(song.id) ?? '')
      const names = [song.title, ...parseAlternateTitles(song.alternate_titles)]
      const titleMatches = names.map((name) =>
        textQuery.score(decodeHtmlEntities(name)),
      )
      const contentMatch = textQuery.score(lyrics)
      const bestTitle = Math.max(0, ...titleMatches.map(titleScoreOf))
      const spelledExactly = names.some((name) =>
        foldForScore(name).includes(typedPhrase),
      )
      const titleScore =
        bestTitle > 0 && spelledExactly
          ? bestTitle + EXACT_SPELLING_BONUS
          : bestTitle
      const termScore =
        titleScore >= TITLE_MATCH_THRESHOLD
          ? TITLE_BAND_OFFSET + titleScore + contentMatch.score / 100
          : contentMatch.score
      return {
        song,
        lyrics,
        matchedForms: [
          ...new Set([
            ...titleMatches.flatMap((match) => match.matchedForms),
            ...contentMatch.matchedForms,
          ]),
        ],
        titleScore,
        termScore,
        boostedScore: termScore * popularityBoost(song),
      }
    })
    .sort(
      (a, b) =>
        b.boostedScore - a.boostedScore ||
        b.song.category_priority - a.song.category_priority ||
        b.termScore - a.termScore ||
        b.titleScore - a.titleScore ||
        a.song.rank - b.song.rank,
    )
}

function titleScoreOf(match: TextMatchScore): number {
  if (match.score === 0) return 0
  return match.phraseStart === 0
    ? match.score
    : match.score - NOT_AT_START_PENALTY
}

/** Songs with a key line and songs presented often rank a little higher. */
function popularityBoost(song: SongCandidate): number {
  const keyLine = song.key_line ? 1 + KEY_LINE_BOOST : 1
  const presented =
    1 +
    (Math.log10(1 + (song.presentation_count ?? 0)) /
      PRESENTATION_BOOST_DENOM) *
      PRESENTATION_BOOST_SCALE
  return keyLine * presented
}

/** Slide HTML as the words a reader sees. */
function plainText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '))
}

/** A name as the operator would type it: folded, punctuation as spaces. */
function foldForScore(text: string): string {
  return decodeHtmlEntities(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
