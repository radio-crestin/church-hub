import { normalizeForIndex } from './search'
import { getSimilarSongsForContent } from './song-groups'
import type { DiscoveryCandidateInput, DiscoveryMatchResult } from './types'
import { getDatabase } from '../../db'
import { songs } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('song-discovery')

/** Below this fuzzy score a candidate is treated as genuinely new, not similar. */
const SIMILAR_MIN_SCORE = 0.55

/** How many fuzzy version matches to surface per candidate. */
const SIMILAR_LIMIT = 5

/**
 * The two cheap exact-match indexes over the whole library, built once per
 * request: `source_filename` → id and `normalizeForIndex(title)` → id.
 * First-writer-wins on collisions — any match means the candidate is present.
 */
interface LibraryExactIndex {
  byFilename: Map<string, number>
  byNormalizedTitle: Map<string, number>
}

/**
 * Case-insensitive title key. `normalizeForIndex` strips diacritics + punctuation
 * but does NOT lowercase (FTS lowercases at tokenization time, so it doesn't need
 * to). Our exact-title dedup compares strings directly, so we must lowercase —
 * otherwise "Am primit darul ceresc" wouldn't match a library "Am primit Darul
 * Ceresc", the song would show as new forever, yet the importer (which keys on
 * LOWER(title)) would skip it as a duplicate. Keep this consistent with the
 * importer's case-insensitive title match.
 */
function normalizeTitleKey(title: string): string {
  return normalizeForIndex(title).toLowerCase()
}

function buildLibraryExactIndex(): LibraryExactIndex {
  const db = getDatabase()
  const libraryRows = db
    .select({
      id: songs.id,
      title: songs.title,
      sourceFilename: songs.sourceFilename,
    })
    .from(songs)
    .all()

  const byFilename = new Map<string, number>()
  const byNormalizedTitle = new Map<string, number>()
  for (const row of libraryRows) {
    if (row.sourceFilename && !byFilename.has(row.sourceFilename)) {
      byFilename.set(row.sourceFilename, row.id)
    }
    const normTitle = normalizeTitleKey(row.title)
    if (normTitle && !byNormalizedTitle.has(normTitle)) {
      byNormalizedTitle.set(normTitle, row.id)
    }
  }
  return { byFilename, byNormalizedTitle }
}

/** Whether the candidate exactly matches a library song by filename or title. */
function isExactLibraryMatch(
  index: LibraryExactIndex,
  candidate: { title: string; sourceFilename: string | null },
): boolean {
  if (
    candidate.sourceFilename &&
    index.byFilename.has(candidate.sourceFilename)
  ) {
    return true
  }
  const normTitle = normalizeTitleKey(candidate.title)
  return normTitle.length > 0 && index.byNormalizedTitle.has(normTitle)
}

/**
 * Classifies a batch of external (not-yet-imported) songs against the local
 * library so the song-discovery screen can show ONLY the ones the user lacks
 * and flag the ones that look like an existing song.
 *
 * Combined dedup, in increasing cost order — the cheap exact passes short-
 * circuit so the expensive FTS-backed fuzzy pass only runs for candidates
 * that are new-by-filename AND new-by-title:
 *   1. exact `source_filename` match  → 'exact-filename'
 *   2. exact normalized-title match   → 'exact-title'
 *   3. fuzzy version match (FTS + Jaccard, reuses getSimilarSongsForContent)
 *      → 'similar' (with matches) else 'new'
 *
 * The library snapshot (filename + normalized-title maps) is built ONCE for
 * the whole batch, so the per-candidate cost of the two exact passes is a
 * couple of hash lookups regardless of library size.
 */
export function matchCandidatesAgainstLibrary(
  candidates: readonly DiscoveryCandidateInput[],
): DiscoveryMatchResult[] {
  if (candidates.length === 0) return []

  try {
    const { byFilename, byNormalizedTitle } = buildLibraryExactIndex()

    return candidates.map((candidate) => {
      // 1) Exact filename.
      if (candidate.sourceFilename) {
        const hit = byFilename.get(candidate.sourceFilename)
        if (hit != null) {
          return {
            tempId: candidate.tempId,
            verdict: 'exact-filename',
            exactSongId: hit,
            similar: [],
          }
        }
      }

      // 2) Exact normalized title (case-insensitive, like the importer).
      const normTitle = normalizeTitleKey(candidate.title)
      if (normTitle) {
        const hit = byNormalizedTitle.get(normTitle)
        if (hit != null) {
          return {
            tempId: candidate.tempId,
            verdict: 'exact-title',
            exactSongId: hit,
            similar: [],
          }
        }
      }

      // 3) Fuzzy version match — only reached when both exact passes missed.
      const similar = getSimilarSongsForContent(
        candidate.title,
        candidate.lyrics,
        { limit: SIMILAR_LIMIT, minScore: SIMILAR_MIN_SCORE },
      )

      return {
        tempId: candidate.tempId,
        verdict: similar.length > 0 ? 'similar' : 'new',
        exactSongId: null,
        similar,
      }
    })
  } catch (error) {
    logger.error(`matchCandidatesAgainstLibrary failed: ${error}`)
    // Fail open: treat everything as new so the operator can still review/import
    // rather than losing the whole batch to one bad query.
    return candidates.map((candidate) => ({
      tempId: candidate.tempId,
      verdict: 'new' as const,
      exactSongId: null,
      similar: [],
    }))
  }
}

/**
 * Cheap "how many of these are new?" count for the BACKGROUND discovery check
 * that drives the sidebar badge + toast. Deliberately skips the expensive FTS
 * fuzzy pass — it only needs filename + normalized-title exact matching, which
 * is two hash lookups per candidate. A candidate counts as new when it matches
 * NO existing library song by filename or title (the fuzzy "similar" ones still
 * count as new here, since the user doesn't actually have them yet).
 *
 * Returns just the count so the background job can decide whether to notify
 * without paying for the full per-candidate similarity payload.
 */
export function countNewCandidates(
  candidates: readonly { title: string; sourceFilename: string | null }[],
): number {
  if (candidates.length === 0) return 0
  try {
    const index = buildLibraryExactIndex()
    let newCount = 0
    for (const candidate of candidates) {
      if (!isExactLibraryMatch(index, candidate)) newCount++
    }
    return newCount
  } catch (error) {
    logger.error(`countNewCandidates failed: ${error}`)
    return 0
  }
}
