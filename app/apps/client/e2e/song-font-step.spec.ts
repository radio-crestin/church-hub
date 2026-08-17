import { type Page, expect, test } from '@playwright/test'

/**
 * Reader font size in the song slides panel: the A- / A+ buttons scale the
 * lyrics list, and one press must move the rendered text by exactly 1px.
 *
 * The step is stored as a *scale multiplier* (1px / 14px base = 1/14), so this
 * spec asserts the px delta a user actually sees rather than the stored value —
 * that is the thing a change to SLIDE_FONT_STEP or to the clamp's rounding
 * precision would silently break.
 */

const FONT_SCALE_KEY = 'song-slides-font-scale'
const STEP_PX = 1
/** Allows for the sub-thousandth residue left by the scale's 4-decimal clamp. */
const TOLERANCE_PX = 0.05

/**
 * Opens a song detail page with the font scale reset to its default, so the
 * measurements start from a known size regardless of what this machine had
 * persisted. Returns false when the instance has no songs to work with.
 */
async function openSongAtDefaultScale(page: Page): Promise<boolean> {
  // Clear it once per tab, not on every navigation — the persistence assertion
  // below reloads the page and must find the value the test just set.
  await page.addInitScript((key) => {
    if (window.sessionStorage.getItem('e2e-font-scale-reset') === null) {
      window.localStorage.removeItem(key)
      window.sessionStorage.setItem('e2e-font-scale-reset', '1')
    }
  }, FONT_SCALE_KEY)

  await page.goto('/songs')
  await page.waitForLoadState('networkidle')

  if (!/\/songs\/\d+/.test(page.url())) {
    const firstSong = page.locator('button:has(h3)').first()
    if (!(await firstSong.isVisible({ timeout: 5000 }).catch(() => false))) {
      return false
    }
    await firstSong.click()
  }

  await expect(page).toHaveURL(/\/songs\/\d+/, { timeout: 5000 })
  await page.waitForTimeout(800)
  return await page
    .locator('[data-testid="song-slide-0"]')
    .isVisible({ timeout: 3000 })
    .catch(() => false)
}

/**
 * Computed font size of the first slide row. The row's number and its lyrics
 * share one style object, so either element measures the same scale; the
 * number is the structurally stable one to target.
 */
async function slideFontSizePx(page: Page): Promise<number> {
  const text = page.locator('[data-testid="song-slide-0"] span').first()
  return Number.parseFloat(
    await text.evaluate((el) => window.getComputedStyle(el).fontSize),
  )
}

// The buttons are labelled from the `songs` namespace, so match either locale.
const INCREASE = /Increase text size|Mărește textul/
const DECREASE = /Decrease text size|Micșorează textul/

test.describe('Song slide font size step', () => {
  test('each press changes the text by exactly 1px', async ({ page }) => {
    if (!(await openSongAtDefaultScale(page))) {
      test.skip(true, 'No song with slides available to test')
      return
    }

    const increase = page.getByRole('button', { name: INCREASE })
    const decrease = page.getByRole('button', { name: DECREASE })
    await expect(increase).toBeVisible()

    const start = await slideFontSizePx(page)

    // Growing: three presses, each exactly one pixel larger than the last.
    let previous = start
    for (let press = 1; press <= 3; press++) {
      await increase.click()
      await page.waitForTimeout(150)
      const current = await slideFontSizePx(page)
      expect(
        Math.abs(current - previous - STEP_PX),
        `press ${press} moved ${(current - previous).toFixed(3)}px`,
      ).toBeLessThan(TOLERANCE_PX)
      previous = current
    }

    // Shrinking returns to the exact starting size — the step is symmetric and
    // the clamp's rounding does not accumulate.
    for (let press = 0; press < 3; press++) {
      await decrease.click()
      await page.waitForTimeout(150)
    }
    expect(Math.abs((await slideFontSizePx(page)) - start)).toBeLessThan(
      TOLERANCE_PX,
    )
  })

  test('stops at the minimum scale and persists the choice', async ({
    page,
  }) => {
    if (!(await openSongAtDefaultScale(page))) {
      test.skip(true, 'No song with slides available to test')
      return
    }

    const decrease = page.getByRole('button', { name: DECREASE })

    // Default scale is 1 and the floor is 0.8 of a 14px base, i.e. 11.2px —
    // under three full 1px presses, after which the button disables.
    for (let press = 0; press < 4; press++) {
      if (await decrease.isDisabled()) break
      await decrease.click()
      await page.waitForTimeout(150)
    }
    await expect(decrease).toBeDisabled()

    const floorPx = await slideFontSizePx(page)
    expect(floorPx).toBeGreaterThan(11)
    expect(floorPx).toBeLessThan(12)

    // The size is a per-device preference: it survives a reload.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    expect(Math.abs((await slideFontSizePx(page)) - floorPx)).toBeLessThan(
      TOLERANCE_PX,
    )
  })
})
