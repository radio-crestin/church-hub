/** The slowest a character is typed, so a short verse reads at a calm pace. */
const MAX_MS_PER_CHARACTER = 45

/**
 * How long a typewriter takes per character: a calm reading pace, sped up so
 * the whole text never takes longer than `maxDurationMs`.
 */
export function msPerCharacter(length: number, maxDurationMs: number): number {
  if (length === 0) return MAX_MS_PER_CHARACTER
  return Math.min(MAX_MS_PER_CHARACTER, maxDurationMs / length)
}
