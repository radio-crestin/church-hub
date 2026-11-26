import type { Page } from '@playwright/test'

/**
 * Samples a slide change frame by frame on a screen surface (the projection
 * root, or the operator's live preview): how opaque each watched text is,
 * and each background layer's colour and opacity. Open it when a spec has to
 * prove what is on screen together during a transition, not just after it.
 */

export interface TransitionFrame {
  /** ms since the request was sent */
  ms: number
  /** Opacity of each watched text, in the order given (0 when absent) */
  texts: number[]
  /** Every background layer, bottom first */
  backgrounds: { color: string; opacity: number }[]
}

/**
 * Sends `body` to `path` from the page and samples `root` each frame until
 * `settledText` is fully opaque over a single background layer (or 4 s).
 */
export function sampleTransition(
  page: Page,
  options: {
    root: string
    texts: string[]
    settledText: string
    path: string
    body: unknown
  },
): Promise<TransitionFrame[]> {
  return page.evaluate(
    ({ root, texts, settledText, path, body }) =>
      new Promise<TransitionFrame[]>((resolve, reject) => {
        const surface = () => document.querySelector(root)
        const textOpacity = (text: string) => {
          const anchor = [
            ...(surface()?.querySelectorAll<HTMLElement>(
              '[data-style-anchor]',
            ) ?? []),
          ].find((element) => element.textContent?.includes(text))
          let opacity = anchor ? 1 : 0
          for (let el = anchor ?? null; el; el = el.parentElement) {
            opacity *= Number(getComputedStyle(el).opacity)
          }
          return opacity
        }
        const frames: TransitionFrame[] = []
        const start = performance.now()
        const sample = () => {
          const backgrounds = [
            ...(surface()?.querySelectorAll<HTMLElement>(
              '[data-testid="screen-background-layer"]',
            ) ?? []),
          ].map((layer) => ({
            opacity: Number(getComputedStyle(layer).opacity),
            color: getComputedStyle(
              layer.querySelector('[data-testid^="screen-background"]') ??
                layer,
            ).backgroundColor,
          }))
          const frame = {
            ms: performance.now() - start,
            texts: texts.map(textOpacity),
            backgrounds,
          }
          frames.push(frame)
          if (textOpacity(settledText) >= 0.999 && backgrounds.length === 1) {
            resolve(frames)
          } else if (frame.ms > 4000) {
            reject(new Error(`"${settledText}" never settled`))
          } else {
            requestAnimationFrame(sample)
          }
        }
        fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch(reject)
        sample()
      }),
    options,
  )
}

/** The most opaque background layer of this colour in a frame (0 if none). */
export function backgroundOpacity(frame: TransitionFrame, color: string) {
  return Math.max(
    0,
    ...frame.backgrounds
      .filter((layer) => layer.color === color)
      .map((layer) => layer.opacity),
  )
}
