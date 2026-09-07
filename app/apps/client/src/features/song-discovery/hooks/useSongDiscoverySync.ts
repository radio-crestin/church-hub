import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { backfillAlternateTitles } from '~/features/songs/service'
import { PROVIDERS } from '../providers'
import {
  countNewCandidates,
  fetchCatalogSignature,
} from '../service/discoveryApi'
import { alternateTitleEntries } from '../utils/alternateTitleEntries'
import { shouldRecoverTitles } from '../utils/shouldRecoverTitles'

const ENABLED_KEY = 'song-discovery-enabled'
const LAST_CHECKED_KEY = 'song-discovery-last-checked'
const SIGNATURE_KEY = 'song-discovery-signature'
const NEW_COUNT_KEY = 'song-discovery-new-count'
const DISMISSED_SIGNATURE_KEY = 'song-discovery-dismissed-signature'
/**
 * The catalogue the songs' real names were last taken from.
 *
 * A library imported with "use the first verse as the title" is filed under
 * each song's opening line, and the name the source gave it was lost. The
 * catalogue still carries it, so whenever this key does not match the
 * catalogue in front of us the names are recovered from it — which is what
 * makes the first launch after an update do the recovery even though the
 * catalogue itself has not changed since the last check.
 */
const TITLES_SIGNATURE_KEY = 'song-discovery-titles-signature'
/**
 * When recovering those names was last attempted, successfully or not.
 *
 * Without it a recovery that keeps failing — no permission, a server that is
 * down — would pull the multi-MB catalogue down again on every single launch,
 * which is exactly the bandwidth the signature check exists to save. A failed
 * attempt waits out the same daily gap the rest of the sync uses before trying
 * again, so it still heals itself without costing anything.
 */
const TITLES_ATTEMPTED_KEY = 'song-discovery-titles-attempted'

/** Minimum gap between real catalog checks — the user asked for a daily cadence. */
const MIN_CHECK_GAP_MS = 1000 * 60 * 60 * 24

/** How often the timer re-evaluates (the daily gap above gates the real work). */
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
 * Background catalog sync: periodically (daily) checks the external source for
 * songs the library lacks and surfaces a count for a badge + a one-time toast.
 *
 * Cheap by design: a HEAD-based signature check skips the multi-MB download
 * entirely when the catalog hasn't changed since the last check; only a changed
 * (or first-seen) catalog is downloaded, parsed and counted via the lightweight
 * /discovery/count endpoint. Results persist in localStorage so the badge
 * survives reloads without re-checking.
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

      const provider = PROVIDERS[0]
      if (!provider) return

      inFlightRef.current = true
      setIsChecking(true)
      try {
        const nextSignature = await fetchCatalogSignature(provider.catalogUrl)
        const storedSignature = localStorage.getItem(SIGNATURE_KEY) ?? ''
        const lastChecked = readNumber(LAST_CHECKED_KEY)
        const dueByTime = Date.now() - lastChecked >= MIN_CHECK_GAP_MS

        // The songs' real names have never been taken from this catalogue, so
        // it is worth downloading even when nothing about it has changed —
        // once a day at most, however often the program is opened.
        const titlesDue = shouldRecoverTitles({
          recoveredSignature: localStorage.getItem(TITLES_SIGNATURE_KEY),
          nextSignature,
          attemptedAt: readNumber(TITLES_ATTEMPTED_KEY),
          now: Date.now(),
          gapMs: MIN_CHECK_GAP_MS,
        })

        if (!force && !titlesDue) {
          // Reliable "unchanged" via the HTTP validator → cheap skip, no download.
          if (nextSignature && nextSignature === storedSignature) {
            localStorage.setItem(LAST_CHECKED_KEY, String(Date.now()))
            return
          }
          // No upstream validator to compare against: we can't tell cheaply if
          // the catalog changed. Don't re-download the whole thing on every open
          // (it competes with the screen and burns bandwidth) — fall back to the
          // daily cadence once we've checked at least once.
          if (!nextSignature && lastChecked > 0 && !dueByTime) {
            return
          }
        }

        const candidates = await provider.fetchCatalog()
        const count = await countNewCandidates(candidates)

        // Give the library back the names the catalogue knows its songs by, so
        // searching finds them by the name anyone would actually type. It runs
        // off the catalogue that was just downloaded — no second trip — and the
        // server leaves alone every song that already carries the name, so this
        // settles into a no-op after the first pass.
        // Recorded before the attempt, not after: a run that dies partway
        // through still counts as one, so a failing recovery cannot turn every
        // launch into another download.
        localStorage.setItem(TITLES_ATTEMPTED_KEY, String(Date.now()))
        try {
          await backfillAlternateTitles(alternateTitleEntries(candidates))
          localStorage.setItem(TITLES_SIGNATURE_KEY, nextSignature)
        } catch {
          // Left for the next check rather than failing the whole sync: the
          // count above is what the operator is waiting on.
        }

        // Prime the discover screen's cache so opening it doesn't re-download.
        queryClient.setQueryData(['discovery-catalog', provider.id], candidates)

        localStorage.setItem(SIGNATURE_KEY, nextSignature)
        localStorage.setItem(NEW_COUNT_KEY, String(count))
        localStorage.setItem(LAST_CHECKED_KEY, String(Date.now()))
        setSignature(nextSignature)
        setNewCount(count)
      } catch {
        // Network/permission failure — leave the prior state untouched and try
        // again on the next tick. No user-facing error for a background job.
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
