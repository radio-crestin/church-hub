/**
 * The corrected lines out of a model's answer, or null when the answer cannot
 * be trusted.
 *
 * A different number of lines means the passage was restructured, which is
 * exactly what the model was told not to do: the slide's line breaks are what
 * the projector lays out, and its style runs are offsets into that text. A
 * passage is left alone rather than projected in a shape the operator did not
 * write.
 */
export function parseCorrectedLines(
  answer: string,
  expected: number,
): string[] | null {
  // Models wrap JSON in prose or a code fence often enough to be worth
  // reaching past rather than failing on.
  const json = answer.match(/\{[\s\S]*\}/)
  if (!json) return null

  try {
    const parsed = JSON.parse(json[0]) as { lines?: unknown }
    if (!Array.isArray(parsed.lines)) return null
    if (parsed.lines.length !== expected) return null
    if (!parsed.lines.every((line) => typeof line === 'string')) return null
    return parsed.lines as string[]
  } catch {
    return null
  }
}
