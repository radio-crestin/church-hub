import { useCallback, useEffect, useState } from 'react'

import type { UpdateInfo } from '../services/versionService'
import { checkForUpdates, getCurrentVersion } from '../services/versionService'

const UPDATE_DISMISSED_KEY = 'update-dismissed-version'
const CHECK_INTERVAL = 1000 * 60 * 60 // Check every hour

// A dev instance is anything served by Vite's dev server (`vite dev`, including
// `tauri dev`) rather than a packaged release build. There's no shipped
// artifact to compare against, so we never check for or prompt updates — and
// surface a "dev instance" badge instead.
const IS_DEV_INSTANCE = import.meta.env.DEV

interface UseAppUpdateResult {
  updateInfo: UpdateInfo | null
  isLoading: boolean
  error: string | null
  isDismissed: boolean
  isDevInstance: boolean
  /**
   * Runs the check. Pressing the button in the UI always reaches GitHub, even
   * on a dev instance — see `checkNow` for why.
   */
  checkNow: () => Promise<void>
  dismissUpdate: () => void
}

export function useAppUpdate(): UseAppUpdateResult {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  /**
   * Fills in the current version without contacting GitHub. Used for the
   * automatic check on a dev instance, where polling would only burn the
   * unauthenticated rate limit for a build that has nothing to upgrade to.
   */
  const showLocalVersionOnly = useCallback(async () => {
    const currentVersion = await getCurrentVersion()
    setUpdateInfo({
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseUrl: '',
      releaseNotes: '',
      downloadUrl: null,
      publishedAt: '',
    })
    setError(null)
    setIsLoading(false)
  }, [])

  /**
   * Checks GitHub for a newer release.
   *
   * This runs on a dev instance too. Automatic polling is still skipped there
   * — see the effect below — but a button labelled "Check now" that silently
   * does nothing is worse than a wasted request, and it made the update flow
   * impossible to try out without cutting a real build first.
   */
  const checkNow = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const info = await checkForUpdates()
      setUpdateInfo(info)

      // Check if this version was dismissed
      const dismissedVersion = localStorage.getItem(UPDATE_DISMISSED_KEY)
      setIsDismissed(dismissedVersion === info.latestVersion)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check for updates',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const dismissUpdate = useCallback(() => {
    if (updateInfo?.latestVersion) {
      localStorage.setItem(UPDATE_DISMISSED_KEY, updateInfo.latestVersion)
      setIsDismissed(true)
    }
  }, [updateInfo?.latestVersion])

  // On mount a dev instance only shows its own version; the operator can still
  // press "Check now" to reach GitHub deliberately.
  useEffect(() => {
    if (IS_DEV_INSTANCE) {
      void showLocalVersionOnly()
      return
    }
    void checkNow()
  }, [checkNow, showLocalVersionOnly])

  // Periodic check — skipped entirely on dev instances (nothing to poll).
  useEffect(() => {
    if (IS_DEV_INSTANCE) return
    const intervalId = setInterval(() => {
      void checkNow()
    }, CHECK_INTERVAL)

    return () => clearInterval(intervalId)
  }, [checkNow])

  return {
    updateInfo,
    isLoading,
    error,
    isDevInstance: IS_DEV_INSTANCE,
    isDismissed,
    checkNow,
    dismissUpdate,
  }
}
