/** Failed device logins one address may make in a window. */
const MAX_FAILURES = 5
const WINDOW_MS = 60_000

/** Failure times, by peer address. */
const failures = new Map<string, number[]>()

function recent(peer: string, now: number): number[] {
  const kept = (failures.get(peer) ?? []).filter((t) => now - t < WINDOW_MS)
  if (kept.length) failures.set(peer, kept)
  else failures.delete(peer)
  return kept
}

/**
 * Seconds before this address may try a device login again, or 0. Phones
 * over WebRTC share the tunnel's one stand-in address, and so its count.
 */
export function deviceLoginRetryAfter(peer: string): number {
  const now = Date.now()
  const times = recent(peer, now)
  if (times.length < MAX_FAILURES) return 0
  return Math.ceil((WINDOW_MS - (now - (times[0] ?? now))) / 1000)
}

/** Counts a refused device login from this address. */
export function recordDeviceLoginFailure(peer: string) {
  const now = Date.now()
  failures.set(peer, [...recent(peer, now), now])
}
