import { normalizeForIndex } from './search'
import { findLibraryVersions } from './song-versions/findLibraryVersions'
import { fillContentHashes } from './source-link/fillContentHashes'
import type {
  DiscoveryCandidateInput,
  DiscoveryMatchResult,
  DiscoveryMatchVerdict,
} from './types'
import { getDatabase } from '../../db'
import { songs } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('song-discovery')

/** Below this fuzzy score a candidate is treated as genuinely new, not similar. */
const SIMILAR_MIN_SCORE = 0.55

/** How many fuzzy version matches to surface per candidate. */
const SIMILAR_LIMIT = 5

/**
 * The cheap exact-match indexes over the whole library, built once per
 * request: source song → id, `content_hash` → id, `source_filename` → id and
 * `normalizeForIndex(title)` → id. First-writer-wins on collisions — any
 * match means the candidate is present.
 */
interface LibraryExactIndex {
  bySourceSong: Map<string, number>
  byContentHash: Map<string, number>
  byFilename: Map<string, number>
  byNormalizedTitle: Map<string, number>
}

const sourceSongKey = (sourceId: string, sourceSongId: string) =>
  `${sourceId}\n${sourceSongId}`

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
  fillContentHashes()
  const db = getDatabase()
  const libraryRows = db
    .select({
      id: songs.id,
      title: songs.title,
      sourceFilename: songs.sourceFilename,
      sourceId: songs.sourceId,
      sourceSongId: songs.sourceSongId,
      contentHash: songs.contentHash,
    })
    .from(songs)
    .all()

  const bySourceSong = new Map<string, number>()
  const byContentHash = new Map<string, number>()
  const byFilename = new Map<string, number>()
  const byNormalizedTitle = new Map<string, number>()
  for (const row of libraryRows) {
    if (row.sourceId && row.sourceSongId) {
      const key = sourceSongKey(row.sourceId, row.sourceSongId)
      if (!bySourceSong.has(key)) bySourceSong.set(key, row.id)
    }
    if (row.contentHash && !byContentHash.has(row.contentHash)) {
      byContentHash.set(row.contentHash, row.id)
    }
    if (row.sourceFilename && !byFilename.has(row.sourceFilename)) {
      byFilename.set(row.sourceFilename, row.id)
    }
    const normTitle = normalizeTitleKey(row.title)
    if (normTitle && !byNormalizedTitle.has(normTitle)) {
      byNormalizedTitle.set(normTitle, row.id)
    }
  }
  return { bySourceSong, byContentHash, byFilename, byNormalizedTitle }
}

/** Whether the candidate exactly matches a library song by filename or title (no source, no lyrics: the caller has neither). */
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
 * none of them found:
 *   1. the same source and source song id → 'exact-source'
 *   2. the same lyrics fingerprint        → 'exact-lyrics'
 *   3. exact `source_filename` match      → 'exact-filename'
 *   4. exact normalized-title match       → 'exact-title'
 *   5. fuzzy version match against the whole library (findLibraryVersions)
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
    const { bySourceSong, byContentHash, byFilename, byNormalizedTitle } =
      buildLibraryExactIndex()
    const exact = (
      candidate: DiscoveryCandidateInput,
      verdict: DiscoveryMatchVerdict,
      id: number,
    ): DiscoveryMatchResult => ({
      tempId: candidate.tempId,
      verdict,
      exactSongId: id,
      similar: [],
    })

    return candidates.map((candidate) => {
      if (candidate.sourceId && candidate.sourceSongId) {
        const hit = bySourceSong.get(
          sourceSongKey(candidate.sourceId, candidate.sourceSongId),
        )
        if (hit != null) return exact(candidate, 'exact-source', hit)
      }
      if (candidate.fingerprint) {
        const hit = byContentHash.get(candidate.fingerprint)
        if (hit != null) return exact(candidate, 'exact-lyrics', hit)
      }

      // Exact filename.
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

      // Exact normalized title (case-insensitive, like the importer).
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

      // Fuzzy version match — only reached when every exact pass missed.
      const similar = findLibraryVersions(candidate.title, candidate.lyrics, {
        limit: SIMILAR_LIMIT,
        minScore: SIMILAR_MIN_SCORE,
      })

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
 * The candidates the library has under neither their file name nor their
 * title: cheap (one pass over the library, then lookups), no similarity.
 */
export function keepNotInLibrary<
  T extends { title: string; sourceFilename: string | null },
>(candidates: readonly T[]): T[] {
  if (candidates.length === 0) return []
  const index = buildLibraryExactIndex()
  return candidates.filter(
    (candidate) => !isExactLibraryMatch(index, candidate),
  )
}
