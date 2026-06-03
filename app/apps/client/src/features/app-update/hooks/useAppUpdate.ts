import { useCallback, useEffect, useState } from 'react'

import type { UpdateInfo } from '../services/versionService'
import {
  checkForUpdates,
  getCurrentVersion,
  openDownloadUrl,
} from '../services/versionService'

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
  isDownloading: boolean
  isDevInstance: boolean
  checkNow: () => Promise<void>
  dismissUpdate: () => void
  downloadUpdate: () => Promise<void>
}

export function useAppUpdate(): UseAppUpdateResult {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const checkNow = useCallback(async () => {
    // Dev instances never reach out to GitHub — that just logs noisy
    // rate-limit errors and there's nothing to upgrade to. Surface the
    // current version so the UI can still show it (with a dev badge).
    if (IS_DEV_INSTANCE) {
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
      return
    }

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

  const downloadUpdate = useCallback(async () => {
    if (!updateInfo) return

    setIsDownloading(true)
    try {
      const url = updateInfo.downloadUrl || updateInfo.releaseUrl
      await openDownloadUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open download')
    } finally {
      setIsDownloading(false)
    }
  }, [updateInfo])

  // Initial check on mount
  useEffect(() => {
    void checkNow()
  }, [checkNow])

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
    isDownloading,
    checkNow,
    dismissUpdate,
    downloadUpdate,
  }
}
