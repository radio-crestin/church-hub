import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { isTauri } from '~/utils/isTauri'
import { takeUpdateOutcome } from '../services/takeUpdateOutcome'
import { setPendingUpdate } from '../services/updateStore'
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
   * Runs the check. Pressing the button in the UI always reaches the release
   * feed, even on a dev instance — see `checkNow` for why.
   */
  checkNow: () => Promise<void>
  dismissUpdate: () => void
}

export function useAppUpdate(): UseAppUpdateResult {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  /**
   * Fills in the current version without contacting anything. Used for the
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
      publishedAt: '',
      installable: false,
    })
    setError(null)
    setIsLoading(false)
  }, [])

  /**
   * Checks for a newer release.
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
      const { info, update } = await checkForUpdates()
      setPendingUpdate(update)
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
  // press "Check now" to reach the release feed deliberately.
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

  // The installer runs after the app has quit, so the only way to know how
  // it went is to ask on the next launch. The answer is handed out once, so
  // the toast shows once however many components use this hook.
  useEffect(() => {
    if (!isTauri() || IS_DEV_INSTANCE) return
    void takeUpdateOutcome().then((outcome) => {
      if (!outcome) return
      if (outcome.status === 'updated') {
        showToast(
          t('sections.updates.outcome.updated', { version: outcome.to }),
          'success',
          { duration: 6000 },
        )
        return
      }
      showToast(
        t('sections.updates.outcome.failed', {
          version: outcome.to,
          current: outcome.current,
        }),
        'error',
        { duration: 12000 },
      )
    })
  }, [showToast, t])

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
