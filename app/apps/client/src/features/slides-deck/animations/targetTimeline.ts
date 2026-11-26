import type { DeckFrame } from './deckFrame'
import { toKeyframe } from './toKeyframe'

/** One effect on a part: its poses over its time in the click group. */
export interface DeckSegment {
  startMs: number
  durationMs: number
  frames: DeckFrame[]
  easing: string
}

/** A part's effects of one click group as one Web Animation. */
export interface DeckTargetTimeline {
  delayMs: number
  durationMs: number
  keyframes: Keyframe[]
}

/**
 * Chains a part's effects of one click group into one animation, so a later
 * effect never covers an earlier one while it waits: each effect starts once
 * the one before it on the part has ended, and between them the part holds
 * how the earlier one left it (rest poses repeated at the same offset make
 * the jump, e.g. a spin's 360° back to 0°).
 */
export function targetTimeline(segments: DeckSegment[]): DeckTargetTimeline {
  const timed: { atMs: number; frame: DeckFrame; easing?: string }[] = []
  let cursorMs = Number.NEGATIVE_INFINITY
  for (const segment of [...segments].sort((a, b) => a.startMs - b.startMs)) {
    const startMs = Math.max(segment.startMs, cursorMs)
    const held = timed.at(-1)
    if (held) timed.push({ atMs: startMs, frame: held.frame })
    const last = segment.frames.length - 1
    segment.frames.forEach((frame, index) => {
      timed.push({
        atMs: startMs + (last ? (segment.durationMs * index) / last : 0),
        frame,
        easing: index < last ? segment.easing : undefined,
      })
    })
    cursorMs = startMs + segment.durationMs
  }
  const startMs = timed[0]?.atMs ?? 0
  const durationMs = Math.max(1, (timed.at(-1)?.atMs ?? 0) - startMs)
  return {
    delayMs: startMs,
    durationMs,
    keyframes: timed.map(({ atMs, frame, easing }) =>
      toKeyframe(frame, Math.min(1, (atMs - startMs) / durationMs), easing),
    ),
  }
}
