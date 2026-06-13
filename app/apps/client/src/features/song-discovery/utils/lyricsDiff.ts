export type DiffLineType = 'context' | 'added' | 'removed'

export interface DiffLine {
  type: DiffLineType
  text: string
}

/** Converts a slide's HTML content to trimmed, non-empty lyric lines. */
function htmlToLines(html: string): string[] {
  // Turn block boundaries into newlines, then read the text.
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')

  let text: string
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div')
    tmp.innerHTML = withBreaks
    text = tmp.textContent ?? ''
  } else {
    // SSR / non-DOM fallback: strip tags crudely.
    text = withBreaks.replace(/<[^>]+>/g, ' ')
  }

  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
}

/**
 * Flattens HTML slides (a candidate draft or a library song — both store slide
 * `content` as HTML) into a single list of lyric lines, with a blank separator
 * between slides so the diff reads block-by-block.
 */
export function slidesToLines(slides: Array<{ content: string }>): string[] {
  const out: string[] = []
  slides.forEach((slide, index) => {
    if (index > 0) out.push('')
    out.push(...htmlToLines(slide.content))
  })
  return out
}

/**
 * GitHub-style line diff via the classic LCS. `oldLines` is the existing library
 * song, `newLines` the candidate being imported — so `removed` lines are in the
 * library but not the new song, and `added` lines are new. O(n·m), which is
 * trivial for song lyrics (tens of lines).
 */
export function diffLines(
  oldLines: readonly string[],
  newLines: readonly string[],
): DiffLine[] {
  const n = oldLines.length
  const m = newLines.length
  // dp[i][j] = LCS length of oldLines[i..] and newLines[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      out.push({ type: 'context', text: oldLines[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'removed', text: oldLines[i] })
      i++
    } else {
      out.push({ type: 'added', text: newLines[j] })
      j++
    }
  }
  while (i < n) out.push({ type: 'removed', text: oldLines[i++] })
  while (j < m) out.push({ type: 'added', text: newLines[j++] })
  return out
}

/** Whether the two line lists differ at all (drives "identical" messaging). */
export function hasChanges(diff: readonly DiffLine[]): boolean {
  return diff.some((line) => line.type !== 'context')
}
