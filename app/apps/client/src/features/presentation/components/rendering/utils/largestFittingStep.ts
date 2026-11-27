/**
 * Largest step in `[low, high]` for which `fits` holds, or `low - 1` when none
 * does. `fits` must hold for every step below one that fits, as text that fits
 * at a font size also fits at any smaller one.
 *
 * Every `fits` call lays the slide's text out again at a new font size, which
 * the browser has to shape from scratch: 2-25 ms each for a projector's large
 * text. A plain binary search over a fit's ~1000 steps takes 10-11 of them
 * inside the frame that shows the new slide, enough to drop several frames of
 * its transition. Starting at `guess` (the size the text would fill exactly if
 * it kept its line breaks) and galloping out from it settles a fit in 2 calls
 * when that guess is right, and never takes more than about twice a binary
 * search's.
 */
export function largestFittingStep(
  low: number,
  high: number,
  guess: number,
  fits: (step: number) => boolean,
): number {
  if (high < low) return low - 1
  const start = Math.min(Math.max(Math.round(guess), low), high)
  // The largest step known to fit and the smallest known not to.
  let fit = low - 1
  let miss = high + 1
  if (fits(start)) {
    fit = start
    for (let gap = 1; fit < high; gap *= 2) {
      const probe = Math.min(fit + gap, high)
      if (!fits(probe)) {
        miss = probe
        break
      }
      fit = probe
    }
  } else {
    miss = start
    for (let gap = 1; miss > low; gap *= 2) {
      const probe = Math.max(miss - gap, low)
      if (fits(probe)) {
        fit = probe
        break
      }
      miss = probe
    }
  }
  while (miss - fit > 1) {
    const mid = Math.floor((fit + miss) / 2)
    if (fits(mid)) fit = mid
    else miss = mid
  }
  return fit
}
