/**
 * Whether the songs' real names should be taken from the catalogue now.
 *
 * A library imported with "use the first verse as the title" is filed under
 * each song's opening line, and the name the source gave it was lost. The
 * catalogue still carries it, so the first launch after the library learned to
 * hold those names has to fetch it — even though the catalogue itself has not
 * changed since the last check, which is what the cheap signature comparison
 * would otherwise conclude.
 *
 * The attempt is what is timed, not the success: a recovery that keeps failing
 * — no permission, a server that is down — must not pull the multi-MB
 * catalogue down again on every launch, so it waits out the same daily gap the
 * rest of the sync uses and heals itself on the next one.
 */
export function shouldRecoverTitles({
  recoveredSignature,
  nextSignature,
  attemptedAt,
  now,
  gapMs,
}: {
  /** The catalogue the names were last recovered from, or null. */
  recoveredSignature: string | null
  /** The catalogue in front of us now. */
  nextSignature: string
  /** When a recovery was last attempted, 0 when never. */
  attemptedAt: number
  now: number
  /** Smallest gap between two attempts. */
  gapMs: number
}): boolean {
  if (recoveredSignature === nextSignature) return false
  return now - attemptedAt >= gapMs
}
