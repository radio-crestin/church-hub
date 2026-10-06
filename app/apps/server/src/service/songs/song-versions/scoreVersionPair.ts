import { intersectionSize, jaccard, type WordSet, wordSetSize } from './wordSet'
import type { SongVersionSuggestion } from '../types'

/** A song as the version comparison sees it: its distinctive words. */
export interface VersionWords {
  title: WordSet
  lyrics: WordSet
}

/**
 * Lyrics overlap (Jaccard of content words) at or above this is treated as a
 * re-titled version even when the titles share no distinctive word. Matches
 * the operator's "more than 70% of the verses are the same" rule.
 */
export const LYRICS_MATCH_THRESHOLD = 0.7

/**
 * A pure-lyrics match (no title overlap) must be backed by at least this many
 * distinct content words on BOTH sides. Guards against degenerate matches
 * between trivially short songs — e.g. two different one-line "Aleluia"
 * choruses would otherwise score 1.0 on a single shared word.
 */
export const MIN_LYRICS_CONTENT_WORDS = 4

/**
 * How likely two songs are versions of one another, 0–1:
 *  - titles sharing a distinctive word: 60% title Jaccard + 40% lyrics
 *    Jaccard (content words, Romanian filler stripped);
 *  - no shared title word: the lyrics Jaccard alone, and only from
 *    `LYRICS_MATCH_THRESHOLD` up (a re-titled version), else 0 — common
 *    filler in titles with no content overlap is an accidental match.
 */
export function scoreVersionPair(
  subject: VersionWords,
  candidate: VersionWords,
): { score: number; reason: SongVersionSuggestion['reason'] } {
  const lyricsSim = jaccard(subject.lyrics, candidate.lyrics)
  const sharesTitleWord = intersectionSize(subject.title, candidate.title) > 0

  if (!sharesTitleWord) {
    if (lyricsSim < LYRICS_MATCH_THRESHOLD) return { score: 0, reason: 'mixed' }
    const enoughWords =
      wordSetSize(subject.lyrics) >= MIN_LYRICS_CONTENT_WORDS &&
      wordSetSize(candidate.lyrics) >= MIN_LYRICS_CONTENT_WORDS
    return { score: enoughWords ? lyricsSim : 0, reason: 'lyrics' }
  }

  const titleSim = jaccard(subject.title, candidate.title)
  const reason: SongVersionSuggestion['reason'] =
    titleSim >= 0.7 ? 'title' : lyricsSim >= 0.5 ? 'lyrics' : 'mixed'
  return { score: 0.6 * titleSim + 0.4 * lyricsSim, reason }
}
