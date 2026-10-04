import { expect, test } from '@playwright/test'

/**
 * The start-up screen fades out over the app for a moment after the page
 * opens. While it fades it must let every click and drag through to the app
 * underneath, or the operator's first action (and raw-mouse e2e drags) is lost.
 */
test('the fading start-up screen never catches a click or drag', async ({
  page,
}) => {
  await page.goto('/')

  // Checked right on load, while the screen is (usually) still fading.
  const overlay = await page.evaluate(() => {
    const screen = document.getElementById('loading-screen')
    const centerHit = document.elementFromPoint(
      window.innerWidth / 2,
      window.innerHeight / 2,
    )
    return {
      present: screen !== null,
      pointerEvents: screen ? getComputedStyle(screen).pointerEvents : 'none',
      catchesCenter: screen !== null && screen.contains(centerHit),
    }
  })

  expect(overlay.pointerEvents).toBe('none')
  expect(overlay.catchesCenter).toBe(false)
  await expect(page.locator('#loading-screen')).toHaveCount(0)
})
