import { getApiUrl } from '~/config'
import type { DiscoveryCandidate, DiscoveryMatchResult } from '../types'

/**
 * Server caps a single match request at 500, but we chunk smaller so the diff
 * streams in more frequently — the progress bar advances in finer steps instead
 * of long static pauses between big jumps.
 */
const MATCH_CHUNK_SIZE = 150

/** The count endpoint is cheap (no FTS) — larger chunks mean fewer round-trips. */
const COUNT_CHUNK_SIZE = 5000

/** Joins a candidate's slide HTML into the plain-ish lyrics the matcher needs. */
function candidateLyrics(candidate: DiscoveryCandidate): string {
  return candidate.parsed.slides.map((s) => s.htmlContent).join(' ')
}

/** Progress + freshly-classified results emitted after each match chunk. */
export interface MatchChunkProgress {
  /** New chunk verdicts (append to accumulate). */
  chunk: DiscoveryMatchResult[]
  /** Candidates classified so far. */
  analyzed: number
  /** Total candidates to classify. */
  total: number
}

/**
 * Classifies external candidates against the local library via
 * POST /api/songs/discovery/match, chunked to respect the server's batch cap.
 * Returns one verdict per candidate, keyed by `tempId`. `onChunk` fires after
 * each chunk so the UI can populate the list progressively and show how much of
 * the catalog has been analyzed.
 */
export async function matchCandidates(
  candidates: DiscoveryCandidate[],
  onChunk?: (progress: MatchChunkProgress) => void,
): Promise<DiscoveryMatchResult[]> {
  const results: DiscoveryMatchResult[] = []
  const total = candidates.length

  for (let i = 0; i < candidates.length; i += MATCH_CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + MATCH_CHUNK_SIZE)
    const response = await fetch(`${getApiUrl()}/api/songs/discovery/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates: chunk.map((c) => ({
          tempId: c.tempId,
          title: c.parsed.title,
          lyrics: candidateLyrics(c),
          sourceFilename: c.sourceFilename,
        })),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Match failed: ${response.statusText}`)
    }

    const json = (await response.json()) as { data: DiscoveryMatchResult[] }
    results.push(...json.data)
    onChunk?.({
      chunk: json.data,
      analyzed: Math.min(i + MATCH_CHUNK_SIZE, total),
      total,
    })
  }

  return results
}

/**
 * Counts how many catalog candidates the library lacks via the cheap
 * POST /api/songs/discovery/count (filename + title only, no FTS). Chunked at
 * a high cap since the per-candidate cost is just hash lookups. Drives the
 * background sync's badge/toast without paying for full similarity.
 */
export async function countNewCandidates(
  candidates: DiscoveryCandidate[],
): Promise<number> {
  let total = 0

  for (let i = 0; i < candidates.length; i += COUNT_CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + COUNT_CHUNK_SIZE)
    const response = await fetch(`${getApiUrl()}/api/songs/discovery/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates: chunk.map((c) => ({
          title: c.parsed.title,
          sourceFilename: c.sourceFilename,
        })),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Count failed: ${response.statusText}`)
    }

    const json = (await response.json()) as { data: { newCount: number } }
    total += json.data.newCount
  }

  return total
}
