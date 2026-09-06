import { useCallback, useState } from 'react'

/**
 * Drop-in replacement for `useState<boolean>` that persists the flag to
 * `localStorage` under `key`.
 *
 * Used for the small "is this panel expanded?" toggles around the app. Like
 * divider positions these are a personal, per-device UI preference: they stay
 * in this machine's `localStorage` and are never round-tripped through the
 * database, so one operator's layout never changes another's.
 */
export function usePersistedBoolean(
  key: string,
  fallback: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValueState] = useState(() => {
    if (typeof window === 'undefined') return fallback
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? fallback : raw === 'true'
    } catch {
      return fallback
    }
  })

  const setValue = useCallback(
    (next: boolean) => {
      setValueState(next)
      try {
        window.localStorage.setItem(key, String(next))
      } catch {
        // Ignore quota/availability errors — non-critical UI state.
      }
    },
    [key],
  )

  return [value, setValue]
}
