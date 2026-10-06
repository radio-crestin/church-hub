import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  checkSourceForNewSongs,
  MIN_CHECK_GAP_MS,
  readSourceCheck,
} from './checkSourceForNewSongs'
import { SONG_SOURCES_QUERY_KEY } from './useSongSources'
import { getSongSources } from '../service/songSourcesApi'

const ENABLED_KEY = 'song-discovery-enabled'
const LAST_CHECKED_KEY = 'song-discovery-last-checked'
/** All sources' state in one string; the badge comes back when it changes. */
const SIGNATURE_KEY = 'song-discovery-signature'
const NEW_COUNT_KEY = 'song-discovery-new-count'
const DISMISSED_SIGNATURE_KEY = 'song-discovery-dismissed-signature'

/** How often the timer re-evaluates (the daily gap gates the real work). */
const REEVALUATE_INTERVAL_MS = 1000 * 60 * 60 * 6

/** Let the app settle (render first) before the on-open catalog check fires. */
const INITIAL_DELAY_MS = 1000 * 2.5

function readNumber(key: string): number {
  const raw = localStorage.getItem(key)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) ? n : 0
}

export interface UseSongDiscoverySyncResult {
  /** New songs the user lacks, surfaced only while unacknowledged for the badge. */
  badgeCount: number
  /** Whether the operator turned the background check off. */
  enabled: boolean
  setEnabled: (value: boolean) => void
  isChecking: boolean
  /** Mark the current catalog signature seen → hides the badge/toast. */
  dismiss: () => void
  /**
   * Run a check now. `force` re-downloads even when the catalog is unchanged
   * (manual "Check now"); `ignoreThrottle` runs despite the daily gap but still
   * skips the download when the HEAD signature is unchanged (on-open check).
   */
  checkNow: (opts?: {
    force?: boolean
    ignoreThrottle?: boolean
  }) => Promise<void>
  /** True the moment a fresh, unacknowledged batch of new songs is detected. */
  hasUnacknowledgedNew: boolean
  newCount: number
}

/**
 * Background catalog sync: periodically (daily) checks every song source,
 * built-in and added from links, for songs the library lacks, and surfaces
 * their total for a badge + a one-time toast.
 *
 * Cheap by design (see checkSourceForNewSongs): an unchanged catalogue is not
 * downloaded again. Results persist in localStorage so the badge survives
 * reloads without re-checking.
 *
 * `enabledExternally` lets the caller gate the whole thing on permission/auth.
 */
export function useSongDiscoverySync(
  enabledExternally: boolean,
): UseSongDiscoverySyncResult {
  const queryClient = useQueryClient()

  const [enabled, setEnabledState] = useState<boolean>(
    () => localStorage.getItem(ENABLED_KEY) !== 'false',
  )
  const [newCount, setNewCount] = useState<number>(() =>
    readNumber(NEW_COUNT_KEY),
  )
  const [signature, setSignature] = useState<string>(
    () => localStorage.getItem(SIGNATURE_KEY) ?? '',
  )
  const [dismissedSignature, setDismissedSignature] = useState<string>(
    () => localStorage.getItem(DISMISSED_SIGNATURE_KEY) ?? '',
  )
  const [isChecking, setIsChecking] = useState(false)

  // Guards against overlapping checks (timer + manual + focus).
  const inFlightRef = useRef(false)

  const setEnabled = useCallback((value: boolean) => {
    localStorage.setItem(ENABLED_KEY, String(value))
    setEnabledState(value)
  }, [])

  const dismiss = useCallback(() => {
    const current = localStorage.getItem(SIGNATURE_KEY) ?? ''
    localStorage.setItem(DISMISSED_SIGNATURE_KEY, current)
    setDismissedSignature(current)
  }, [])

  const checkNow = useCallback(
    async (opts?: { force?: boolean; ignoreThrottle?: boolean }) => {
      const force = opts?.force ?? false
      const ignoreThrottle = force || (opts?.ignoreThrottle ?? false)

      if (inFlightRef.current) return
      if (!force && !enabled) return
      if (
        !ignoreThrottle &&
        Date.now() - readNumber(LAST_CHECKED_KEY) < MIN_CHECK_GAP_MS
      ) {
        return
      }

      inFlightRef.current = true
      setIsChecking(true)
      try {
        const sources = await queryClient.fetchQuery({
          queryKey: SONG_SOURCES_QUERY_KEY,
          queryFn: getSongSources,
        })
        // One at a time: each catalogue can be several MB.
        for (const source of sources) {
          await checkSourceForNewSongs(source, queryClient, force).catch(
            (error) =>
              // Left as last checked; tried again on the next tick.
              // biome-ignore lint/suspicious/noConsole: background job
              console.warn(`[song-discovery] ${source.name}:`, error),
          )
        }

        const checks = sources.map((source) => ({
          id: source.id,
          ...readSourceCheck(source.id),
        }))
        const count = checks.reduce((sum, check) => sum + check.count, 0)
        const nextSignature = checks
          .map((c) => `${c.id}:${c.signature}:${c.count}`)
          .join('|')
        localStorage.setItem(SIGNATURE_KEY, nextSignature)
        localStorage.setItem(NEW_COUNT_KEY, String(count))
        localStorage.setItem(LAST_CHECKED_KEY, String(Date.now()))
        setSignature(nextSignature)
        setNewCount(count)
      } catch (error) {
        // The source list itself failed (server down): try on the next tick.
        // biome-ignore lint/suspicious/noConsole: background job
        console.warn('[song-discovery] Background check failed', error)
      } finally {
        inFlightRef.current = false
        setIsChecking(false)
      }
    },
    [enabled, queryClient],
  )

  // On-open check (shortly after launch) + periodic re-evaluation. Disabled
  // entirely when the caller withholds permission or the operator turned it off.
  useEffect(() => {
    if (!enabledExternally || !enabled) return

    // Skip the heavy background catalog check under automated browsers (e2e):
    // every test runs in a fresh context (empty localStorage), so this would
    // re-download + re-parse the multi-MB catalog on every test, hammering the
    // server and the main thread. Tests drive the discovery screen directly.
    if (typeof navigator !== 'undefined' && navigator.webdriver) return

    // Run on every program open regardless of the daily gap — the HEAD check
    // makes an unchanged catalog nearly free, and it lets the Discover button
    // show its "searching" animation right away.
    const initialId = window.setTimeout(() => {
      void checkNow({ ignoreThrottle: true })
    }, INITIAL_DELAY_MS)

    const intervalId = window.setInterval(() => {
      void checkNow()
    }, REEVALUATE_INTERVAL_MS)

    // A returning user (window focus) gets a fresh check, still daily-throttled.
    const onFocus = () => {
      void checkNow()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearTimeout(initialId)
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabledExternally, enabled, checkNow])

  const hasUnacknowledgedNew =
    enabled &&
    newCount > 0 &&
    signature !== '' &&
    signature !== dismissedSignature

  return {
    badgeCount: hasUnacknowledgedNew ? newCount : 0,
    enabled,
    setEnabled,
    isChecking,
    dismiss,
    checkNow,
    hasUnacknowledgedNew,
    newCount,
  }
}
