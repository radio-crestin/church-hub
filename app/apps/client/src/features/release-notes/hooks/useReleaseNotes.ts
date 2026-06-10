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
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}
