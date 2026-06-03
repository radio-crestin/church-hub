/**
 * Per-device persistence for "I've already seen this suggestion and it's not
 * a version" decisions, scoped to localStorage. We deliberately keep this
 * client-side for v1: the matching pipeline is cheap to rerun, the
 * dismissal isn't safety-critical, and skipping a DB round-trip keeps the
 * panel snappy. If/when the suggestions queue moves server-side, this can
 * be replaced with a `song_group_dismissals` table without touching the
 * panel — the read/write helpers are the only public surface.
 */

const STORAGE_KEY = 'song-version-suggestions:dismissed'

function key(subjectSongId: number, suggestedSongId: number): string {
  // Sort the pair so dismissing A→B also dismisses B→A. Suggestions are
  // symmetric: if the operator says "these aren't versions of each other",
  // we don't want to nag them from the other song.
  const [a, b] = [subjectSongId, suggestedSongId].sort((x, y) => x - y)
  return `${a}-${b}`
}

function readAll(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr) : new Set()
  } catch {
    return new Set()
  }
}

function writeAll(set: Set<string>): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // Quota exhausted (unlikely at this size) — silently drop. Worst case
    // the operator sees the same suggestion again next time.
  }
}

export function isDismissed(
  subjectSongId: number,
  suggestedSongId: number,
): boolean {
  return readAll().has(key(subjectSongId, suggestedSongId))
}

export function dismissSuggestion(
  subjectSongId: number,
  suggestedSongId: number,
): void {
  const set = readAll()
  set.add(key(subjectSongId, suggestedSongId))
  writeAll(set)
}

export function undoDismiss(
  subjectSongId: number,
  suggestedSongId: number,
): void {
  const set = readAll()
  set.delete(key(subjectSongId, suggestedSongId))
  writeAll(set)
}
