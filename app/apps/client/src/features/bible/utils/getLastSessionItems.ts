import type { BibleHistoryItem } from '../types'

/**
 * How long the history may stay quiet before the next verse counts as a new
 * sitting. Three hours comfortably spans a service (including a long break)
 * while still separating the morning service from the evening one.
 */
export const SESSION_GAP_MS = 3 * 60 * 60 * 1000

/**
 * Picks the verses belonging to the most recent session — the newest verse and
 * everything shown before it until the history goes quiet for longer than
 * `gapMs`.
 *
 * Deliberately gap-based rather than "everything from today": a service that
 * runs past midnight, or an export done the morning after, would otherwise lose
 * the very verses the user means by "last session".
 *
 * Returns newest first; an empty list stays empty.
 */
export function getLastSessionItems(
  items: BibleHistoryItem[],
  gapMs: number = SESSION_GAP_MS,
): BibleHistoryItem[] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt)
  const session: BibleHistoryItem[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const previous = session[session.length - 1]
    if (previous.createdAt - sorted[i].createdAt > gapMs) break
    session.push(sorted[i])
  }

  return session
}
