import { useEffect, useState } from 'react'

import { matchCandidates } from '../service/discoveryApi'
import type { DiscoveryCandidate, DiscoveryMatchResult } from '../types'

export interface MatchProgress {
  analyzed: number
  total: number
}

/**
 * Diffs the fetched catalog against the local library, streaming results as
 * each chunk comes back so the list populates progressively and a progress
 * indicator can show how much of the catalog has been analyzed.
 *
 * Re-runs only when the provider, the candidate set, or `refreshNonce` changes
 * — NOT when the library changes. Importing a song must not silently re-run the
 * whole diff; the screen just drops the imported row and the rest of the list
 * stays put. Bumping `refreshNonce` (the manual "Refresh catalog" action) is the
 * one explicit way to re-analyze. A run guard prevents a stale run from
 * committing results after the inputs change.
 */
export function useMatchCandidates(
  providerId: string | null,
  candidates: DiscoveryCandidate[],
  refreshNonce: number,
) {
  const [results, setResults] = useState<DiscoveryMatchResult[]>([])
  const [progress, setProgress] = useState<MatchProgress>({
    analyzed: 0,
    total: 0,
  })
  const [isMatching, setIsMatching] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (candidates.length === 0) {
      setResults([])
      setProgress({ analyzed: 0, total: 0 })
      setIsMatching(false)
      return
    }

    let cancelled = false
    setIsMatching(true)
    setError(null)
    setResults([])
    setProgress({ analyzed: 0, total: candidates.length })

    matchCandidates(candidates, ({ chunk, analyzed, total }) => {
      if (cancelled) return
      setResults((prev) => [...prev, ...chunk])
      setProgress({ analyzed, total })
    })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setIsMatching(false)
      })

    return () => {
      cancelled = true
    }
  }, [providerId, candidates, refreshNonce])

  return { results, isMatching, progress, error }
}
