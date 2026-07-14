import { useQuery } from '@tanstack/react-query'

import { inspectBackup } from '../service'

/**
 * Loads the contents of a single Drive backup (song titles, schedules,
 * playlists, per-table counts). The server downloads the whole backup file to
 * read it, so results are cached per file id — a backup's contents never
 * change once uploaded.
 */
export function useBackupContents(fileId: string | null) {
  return useQuery({
    queryKey: ['backup', 'contents', fileId],
    queryFn: () => inspectBackup(fileId as string),
    enabled: fileId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
}
