import {
  dismissUpdateError,
  installUpdate,
  startDownload,
  useUpdateState,
} from '../services/updateStore'

/**
 * Drives downloading and installing a new version.
 *
 * The work is done by the updater plugin and tracked in one store shared
 * by every component that shows it, so the sidebar badge and the updates
 * page always agree on where the download stands.
 */
export function useUpdateDownload() {
  const state = useUpdateState()

  const progress =
    state.totalBytes && state.totalBytes > 0
      ? Math.min(
          100,
          Math.round((state.receivedBytes / state.totalBytes) * 100),
        )
      : null

  return {
    state,
    progress,
    isDownloading: state.phase === 'downloading',
    isReady: state.phase === 'ready',
    isInstalling: state.phase === 'installing',
    error: state.phase === 'error' ? state.error : null,
    errorCode: state.phase === 'error' ? state.errorCode : null,
    startDownload,
    dismissError: dismissUpdateError,
    install: installUpdate,
  }
}
