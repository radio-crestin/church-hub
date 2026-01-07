import { useCallback, useEffect, useState } from 'react'

import type { UpdateInfo } from '../services/versionService'
import { checkForUpdates, openDownloadUrl } from '../services/versionService'

const UPDATE_DISMISSED_KEY = 'update-dismissed-version'
const CHECK_INTERVAL = 1000 * 60 * 60 // Check every hour

interface UseAppUpdateResult {
  updateInfo: UpdateInfo | null
  isLoading: boolean
  error: string | null
  isDismissed: boolean
  isDownloading: boolean
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

  // Periodic check
  useEffect(() => {
    const intervalId = setInterval(() => {
      void checkNow()
    }, CHECK_INTERVAL)

    return () => clearInterval(intervalId)
  }, [checkNow])

  return {
    updateInfo,
    isLoading,
    error,
    isDismissed,
    isDownloading,
    checkNow,
    dismissUpdate,
    downloadUpdate,
  }
}
