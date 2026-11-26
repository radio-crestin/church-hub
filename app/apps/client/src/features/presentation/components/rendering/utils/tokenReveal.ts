import type { TypewriterReveal } from './revealAfter'
import type { RevealOf } from './revealMarkup'

/**
 * The part of a typewriter's reveal that falls in one token, from `start` up
 * to `end` of the text, in the token's own offsets; undefined when the token
 * shows whole.
 */
export function tokenReveal(
  reveal: TypewriterReveal | null | undefined,
  start: number,
  end: number,
): RevealOf | undefined {
  if (!reveal) return undefined
  const hidden = reveal.hidden
    .filter(([from, to]) => from < end && to > start)
    .map(([from, to]): [number, number] => [
      Math.max(from, start) - start,
      Math.min(to, end) - start,
    ])
  const caret =
    reveal.caret >= start && reveal.caret < end ? reveal.caret - start : null
  if (hidden.length === 0 && caret === null) return undefined
  return { hidden, caret }
}
