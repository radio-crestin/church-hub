import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { usePermissions } from '~/provider/permissions-provider'
import {
  getSongUpdates,
  recordSourceNewCount,
  runSongUpdates,
  type SongUpdatesState,
  setAutoUpdateSongs,
} from '../service/songUpdatesApi'

export const SONG_UPDATES_QUERY_KEY = ['song-updates'] as const

/** Often while a check runs, rarely otherwise (the server checks daily). */
const RUNNING_POLL_MS = 3000
const IDLE_POLL_MS = 5 * 60_000

/**
 * The server's song updates: each source's new songs and what the automatic
 * update added. The heavy work is the server's, in a worker thread; this
 * only reads the result.
 */
export function useSongUpdates() {
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const query = useQuery<SongUpdatesState>({
    queryKey: SONG_UPDATES_QUERY_KEY,
    queryFn: getSongUpdates,
    enabled: hasPermission('songs.view'),
    refetchInterval: (q) =>
      q.state.data?.running ? RUNNING_POLL_MS : IDLE_POLL_MS,
  })
  const setState = (state: SongUpdatesState) =>
    queryClient.setQueryData(SONG_UPDATES_QUERY_KEY, state)

  const run = useMutation({ mutationFn: runSongUpdates, onSuccess: setState })
  const autoUpdate = useMutation({
    mutationFn: setAutoUpdateSongs,
    onSuccess: setState,
  })
  const newCount = useMutation({
    mutationFn: ({ sourceId, count }: { sourceId: string; count: number }) =>
      recordSourceNewCount(sourceId, count),
    onSuccess: setState,
  })

  return {
    state: query.data,
    isRunning: query.data?.running ?? false,
    checkNow: (options: { force?: boolean; sourceIds?: string[] } = {}) =>
      run.mutateAsync(options),
    setAutoUpdate: autoUpdate.mutate,
    recordNewCount: (sourceId: string, count: number) =>
      newCount.mutate({ sourceId, count }),
  }
}
