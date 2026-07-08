import { useEffect, useState } from 'react'

import { usePresentationState } from './usePresentationState'

const STORAGE_KEY = 'presentation:session-started-at'

function readStartedAt(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function writeStartedAt(value: number | null): void {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Ignore quota / private-mode errors — the timer is non-critical UI.
  }
}

/**
 * Elapsed milliseconds of the current presentation session, or `null` when
 * nothing is live.
 *
 * The session starts the moment content first goes live (from a hidden/empty
 * state) and ends when the operator hides it. It deliberately keeps running
 * across song switches: presenting another song while one is already live never
 * blanks the state, so the timer carries on. The start time is persisted in
 * `localStorage`, so it also survives the stage board remounting when the
 * operator opens a different song's page (or reloads the app mid-service).
 */
export function usePresentationSessionElapsed(): number | null {
  const { data: state } = usePresentationState()
  // Until the state has loaded we don't know if anything is live, so we must
  // leave the persisted start time alone — otherwise a full reload (state
  // briefly `undefined`) would wipe it and restart the clock at zero.
  const stateLoaded = state !== undefined
  const isLive =
    stateLoaded &&
    !state.isHidden &&
    (state.temporaryContent !== null || state.currentSongSlideId !== null)

  const [now, setNow] = useState(() => Date.now())

  // Start the session on the first live tick; clear it when nothing is live.
  useEffect(() => {
    if (!stateLoaded) return
    if (isLive) {
      if (readStartedAt() === null) writeStartedAt(Date.now())
    } else if (readStartedAt() !== null) {
      writeStartedAt(null)
    }
  }, [stateLoaded, isLive])

  // Tick once a second while live so the elapsed value stays current.
  useEffect(() => {
    if (!isLive) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isLive])

  if (!isLive) return null
  return Math.max(0, now - (readStartedAt() ?? now))
}
