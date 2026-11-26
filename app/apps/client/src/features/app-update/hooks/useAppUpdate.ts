import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isWebApp } from '~/config'
import { useToast } from '~/ui/toast'
import { isTauri } from '~/utils/isTauri'
import { takeUpdateOutcome } from '../services/takeUpdateOutcome'
import { setPendingUpdate } from '../services/updateStore'
import type { UpdateInfo } from '../services/versionService'
import { checkForUpdates, getCurrentVersion } from '../services/versionService'

const CHECK_INTERVAL = 1000 * 60 * 60 // Check every hour

// A dev instance is anything served by Vite's dev server (`vite dev`, including
// `tauri dev`) rather than a packaged release build. There's no shipped
// artifact to compare against, so we never check for or prompt updates — and
// surface a "dev instance" badge instead.
const IS_DEV_INSTANCE = import.meta.env.DEV

// Checks run on their own only where an update can follow: not on a dev
// instance, and not in the web app, which updates itself as a PWA.
const CHECKS_ON_ITS_OWN = !IS_DEV_INSTANCE && !isWebApp

interface UseAppUpdateResult {
  updateInfo: UpdateInfo | null
  isLoading: boolean
  error: string | null
  isDevInstance: boolean
  /**
   * Runs the check. Pressing the button in the UI always reaches the release
   * feed, even on a dev instance — see `checkNow` for why.
   */
  checkNow: () => Promise<void>
}

export function useAppUpdate(): UseAppUpdateResult {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check for updates',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  // On mount a dev instance (or the web app) only shows its own version; on a
  // dev instance the operator can still press "Check now" to reach the feed.
  useEffect(() => {
    if (!CHECKS_ON_ITS_OWN) {
      void showLocalVersionOnly()
      return
    }
    void checkNow()
  }, [checkNow, showLocalVersionOnly])

  // Periodic check — skipped on dev instances and in the web app.
  useEffect(() => {
    if (!CHECKS_ON_ITS_OWN) return
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
    checkNow,
  }
}
