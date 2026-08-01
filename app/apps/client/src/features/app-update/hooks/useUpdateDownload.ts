import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { isTauri } from '~/utils/isTauri'
import {
  cancelUpdateDownload,
  getUpdateDownloadState,
  installUpdate,
  startUpdateDownload,
  type UpdateDownloadState,
} from '../services/updateDownloadService'

const STATUS_KEY = ['app-update', 'download-status']

/**
 * Drives downloading and installing a new version.
 *
 * The work happens in the sidecar, so this hook only starts it and follows
 * along. While a download runs the status is polled twice a second — a short,
 * single-consumer operation where polling is simpler than a new WebSocket
 * message type, and it keeps the progress bar honest even if the window was
 * closed and reopened mid-download.
 */
export function useUpdateDownload(
  assetUrl: string | null,
  version: string | null,
) {
  const queryClient = useQueryClient()

  const statusQuery = useQuery<UpdateDownloadState | null>({
    queryKey: [...STATUS_KEY, assetUrl, version],
    queryFn: () => getUpdateDownloadState(assetUrl, version ?? undefined),
    enabled: isTauri() && !!assetUrl,
    refetchInterval: (query) =>
      query.state.data?.phase === 'downloading' ? 500 : false,
    staleTime: 0,
  })

  const state = statusQuery.data ?? null

  const download = useMutation({
    mutationFn: () => {
      if (!assetUrl) throw new Error('no_asset')
      return startUpdateDownload(assetUrl, version ?? '')
    },
    onSuccess: (next) => {
      queryClient.setQueryData([...STATUS_KEY, assetUrl, version], next)
    },
  })

  const cancel = useMutation({
    mutationFn: cancelUpdateDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY })
    },
  })

  /**
   * Starts the installer and quits the app. The helper waits for this process
   * to disappear before it replaces anything, then relaunches — so from the
   * operator's side the app simply restarts on the new version.
   */
  const install = useCallback(async () => {
    const result = await installUpdate()
    if (!result.success) return result

    if (isTauri()) {
      const { exit } = await import('@tauri-apps/plugin-process')
      // Give the helper a moment to be scheduled before the app disappears.
      setTimeout(() => void exit(0), 400)
    }
    return result
  }, [])

  const progress =
    state?.totalBytes && state.totalBytes > 0
      ? Math.min(
          100,
          Math.round((state.receivedBytes / state.totalBytes) * 100),
        )
      : null

  return {
    state,
    progress,
    isDownloading: state?.phase === 'downloading',
    isReady: state?.phase === 'ready',
    isInstalling: state?.phase === 'installing',
    error: state?.phase === 'error' ? state.error : null,
    startDownload: download.mutateAsync,
    isStarting: download.isPending,
    cancelDownload: cancel.mutateAsync,
    install,
  }
}
