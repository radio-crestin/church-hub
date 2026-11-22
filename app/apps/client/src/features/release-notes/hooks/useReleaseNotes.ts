import { useQuery } from '@tanstack/react-query'

import { getBundledReleaseNotes, getReleaseNotes } from '../service'

export const RELEASE_NOTES_QUERY_KEY = ['release-notes']

/**
 * Provides the merged release-notes list. The bundled changelog is used as
 * initial data so the section renders instantly and offline, while a background
 * fetch folds in any newer versions from GitHub.
 */
export function useReleaseNotes() {
  return useQuery({
    queryKey: RELEASE_NOTES_QUERY_KEY,
    queryFn: getReleaseNotes,
    initialData: getBundledReleaseNotes,
    // Bundled at build time: stale at once, so the GitHub fetch still runs
    // (initial data counts as fetched now, which held it off for staleTime).
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}
