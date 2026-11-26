import { useQuery } from '@tanstack/react-query'

import { loadChurchSongs } from '../service/loadChurchSongs'

/** Read again every minute while open: other devices' edits show up. */
const REFRESH_MS = 60_000

/**
 * The church's songs, read straight from its path in the bucket, while
 * `enabled` (the PC isn't reached).
 */
export function useChurchSongs(readUrl: string, enabled = true) {
  return useQuery({
    queryKey: ['church-songs', readUrl],
    queryFn: () => loadChurchSongs(readUrl),
    refetchInterval: REFRESH_MS,
    enabled,
  })
}
