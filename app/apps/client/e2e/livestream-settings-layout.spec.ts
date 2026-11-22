import { expect, test } from '@playwright/test'

/**
 * T-032 review: the Live Stream settings pages (YouTube, OBS, audio mixer)
 * are laid out like the app settings: a rail on the left with the settings
 * pages, and the sections full width beside it, the one in view highlighted.
 */

const PAGES = [
  {
    path: '/livestream/youtube',
    page: 'youtube-settings-page',
    section: 'youtube-settings-account',
  },
  {
    path: '/livestream/obs',
    page: 'obs-settings-page',
    section: 'obs-settings-steps',
  },
  {
    path: '/livestream/mixer',
    page: 'mixer-settings-page',
    section: 'mixer-settings-channels',
  },
]

test.describe('Live Stream settings pages', () => {
  test.use({ viewport: { width: 1600, height: 900 } })

  for (const { path, page: pageId, section } of PAGES) {
    test(`${path}: a rail and full-width sections, like the app settings`, async ({
      page,
    }) => {
      await page.goto(path)
      const rail = page.getByTestId('livestream-settings-rail')
      await expect(rail).toBeVisible()
      // The settings pages, the open one marked.
      for (const href of ['/livestream/youtube', '/livestream/obs']) {
        await expect(rail.locator(`a[href="${href}"]`)).toBeVisible()
      }
      await expect(rail.locator(`a[href="${path}"]`)).toHaveClass(/indigo/)
      // Only the pages: the sections are not listed again.
      await expect(rail.locator('a')).toHaveCount(4)
      await expect(rail.locator('button')).toHaveCount(0)

      // The section in view is highlighted on the right (the last one at the end).
      const railBox = await rail.boundingBox()
      const card = page.getByTestId(section)
      await card.scrollIntoViewIfNeeded()
      await card.hover()
      await page.mouse.wheel(0, 5000)
      await expect(card).toHaveAttribute('data-active', '')
      await expect(page.locator('[data-active]')).toHaveCount(1)
      const pageBox = await page.getByTestId(pageId).boundingBox()
      const cardBox = await card.boundingBox()
      expect(railBox && cardBox && pageBox).toBeTruthy()
      expect(cardBox!.x - (railBox!.x + railBox!.width)).toBeLessThan(80)
      expect(
        pageBox!.x + pageBox!.width - (cardBox!.x + cardBox!.width),
      ).toBeLessThan(80)
    })
  }

  test('on a phone the rail gives way to the back link', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/livestream/obs')
    await expect(page.getByTestId('obs-settings-access')).toBeVisible()
    await expect(page.getByTestId('livestream-settings-rail')).toBeHidden()
    await page
      .getByRole('link', {
        name: /^(Back to Live Stream|Înapoi la Live Stream)$/,
      })
      .click()
    await expect(page).toHaveURL(/\/livestream$/)
  })
})
