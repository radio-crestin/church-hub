import { useCallback, useState } from 'react'

/**
 * A one-of-N choice the operator makes and expects to find again — kept in
 * localStorage, so on the desktop app it survives closing and reopening.
 *
 * Per-device on purpose: which filter someone leaves a panel on belongs to the
 * machine they work at, not to the shared database (the same rule the divider
 * and layout preferences follow).
 *
 * An unknown stored value falls back rather than throwing, so a renamed choice
 * degrades to the default instead of breaking the panel.
 */
export function usePersistedChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const [choice, setChoice] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key) as T | null
      return stored && choices.includes(stored) ? stored : fallback
    } catch {
      return fallback
    }
  })

  const select = useCallback(
    (next: T) => {
      setChoice(next)
      try {
        localStorage.setItem(key, next)
      } catch {
        // Storage unavailable (private mode) — the choice just won't persist.
      }
    },
    [key],
  )

  return [choice, select]
}
