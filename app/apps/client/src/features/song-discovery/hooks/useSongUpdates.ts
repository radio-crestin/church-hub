import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { NOTIFICATIONS_QUERY_KEY } from '~/features/notifications/service/notificationsApi'
import { usePermissions } from '~/provider/permissions-provider'
import {
  cancelSongUpdates,
  getSongUpdates,
  recountSourceSongs,
  runSongUpdates,
  type SongUpdatesState,
  setAutoUpdateSongs,
  syncPendingSongs,
} from '../service/songUpdatesApi'

export const SONG_UPDATES_QUERY_KEY = ['song-updates'] as const

/** Often while a check runs, rarely otherwise (the server checks daily). */
const RUNNING_POLL_MS = 3000
const IDLE_POLL_MS = 5 * 60_000

/**
 * The server's song updates: each source's waiting songs and what the sync
 * did. The heavy work is the server's, in a worker thread; this only reads
 * the result and asks for a check, a cancel or a sync.
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
  // A check, a cancel or a sync adds to the notifications.
  const setState = (state: SongUpdatesState) => {
    queryClient.setQueryData(SONG_UPDATES_QUERY_KEY, state)
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
  }

  const run = useMutation({ mutationFn: runSongUpdates, onSuccess: setState })
  const cancel = useMutation({
    mutationFn: cancelSongUpdates,
    onSuccess: setState,
  })
  const sync = useMutation({
    mutationFn: syncPendingSongs,
    onSuccess: setState,
  })
  const autoUpdate = useMutation({
    mutationFn: setAutoUpdateSongs,
    onSuccess: setState,
  })
  const recount = useMutation({
    mutationFn: recountSourceSongs,
    onSuccess: setState,
  })

  const sources = query.data?.sources ?? []
  return {
    state: query.data,
    isRunning: query.data?.running ?? false,
    /** New songs and updates waiting for the user's approval. */
    pendingCount: sources.reduce(
      (sum, s) => sum + s.newCount + s.changedCount,
      0,
    ),
    checkNow: (options: { force?: boolean; sourceIds?: string[] } = {}) =>
      run.mutateAsync(options),
    cancel: () => cancel.mutate(),
    syncPending: () => sync.mutateAsync(),
    isSyncing: sync.isPending,
    setAutoUpdate: autoUpdate.mutate,
    recount: (sourceId: string) => recount.mutate(sourceId),
  }
}
