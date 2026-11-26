import type { TextSpan } from './typedSpans'

/** What a typewriter still hides: the text after the caret, and the caret's place. */
export interface TypewriterReveal {
  hidden: TextSpan[]
  caret: number
}

/** What stays hidden once `typed` characters of `spans` are typed; null: nothing. */
export function revealAfter(
  spans: TextSpan[],
  typed: number,
): TypewriterReveal | null {
  let left = typed
  for (const [index, [start, end]] of spans.entries()) {
    if (left < end - start) {
      const caret = start + left
      return { caret, hidden: [[caret, end], ...spans.slice(index + 1)] }
    }
    left -= end - start
  }
  return null
}
