import { expect, test } from '@playwright/test'

/**
 * Every top-level page follows the page standard (docs/page-layout.md): its
 * title is the h1 of a shared PageHeader, and on a phone nothing scrolls
 * sideways.
 */

const PAGES = [
  '/songs',
  '/songs/discover',
  '/bible',
  '/music',
  '/schedules',
  '/gallery',
  '/song-key',
  '/livestream',
  '/live-translation',
  '/present',
  '/dashboard',
  '/notifications',
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

for (const viewport of VIEWPORTS) {
  test(`pages use the shared header on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(viewport)
    for (const path of PAGES) {
      await page.goto(path)
      const title = page.locator('header > div > h1')
      await expect(title, `${path} has a PageHeader title`).toBeVisible()
      await expect(title).not.toHaveText('')

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0)
    }
  })
}
