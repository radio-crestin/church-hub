// Never hold the screenshot back longer than this.
const MAX_WAIT_MS = 1000

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Waits until the page stops moving, so the screenshot shows where things
 * end up, not halfway: e.g. the phone menu drawer that is still sliding out
 * when Feedback is tapped in it. Two frames first let the closing styles
 * apply and start their transitions; endless animations (spinners) are not
 * waited for.
 */
export async function waitForAnimationsToSettle(): Promise<void> {
  await nextFrame()
  await nextFrame()
  const running = document
    .getAnimations()
    .filter(
      (animation) =>
        animation.playState === 'running' &&
        animation.effect?.getComputedTiming().iterations !== Infinity,
    )
  if (running.length === 0) return
  await Promise.race([
    Promise.allSettled(running.map((animation) => animation.finished)),
    delay(MAX_WAIT_MS),
  ])
}
