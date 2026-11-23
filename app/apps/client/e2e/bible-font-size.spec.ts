import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * The Bible verse list has the song page's A↓/A↑ buttons: they resize the
 * verse text, and the size is remembered on this device.
 */

const fontSizeOf = (locator: Locator) =>
  locator.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))

/** Walks the reader down to John 3 and returns the first verse on show. */
async function walkToJohn3(page: Page) {
  // A verse left on screen by an earlier test, or the chapter last visited on
  // this device, would open /bible there instead of on the book list.
  await page.request.post('/api/presentation/clear-temporary')
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('church-hub-last-visited'))
  await page.goto('/bible')
  await page.getByRole('button', { name: 'Ioan', exact: true }).click()
  await page.getByRole('button', { name: '3', exact: true }).click()
  const verse = page.locator('[data-verse]').first()
  await expect(verse).toBeVisible({ timeout: 10000 })
  return verse
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('bible-verses-font-scale'))
})

test('the A↓/A↑ buttons resize the verse text and keep the size on this device', async ({
  page,
}) => {
  const verse = await walkToJohn3(page)
  const original = await fontSizeOf(verse)

  await page.getByTestId('bible-font-increase').click()
  await page.getByTestId('bible-font-increase').click()
  await expect.poll(() => fontSizeOf(verse)).toBeGreaterThan(original)
  const enlarged = await fontSizeOf(verse)

  // A new tab on this device opens the verses at the size chosen here.
  const other = await page.context().newPage()
  await other.setViewportSize({ width: 1400, height: 900 })
  const reloaded = await walkToJohn3(other)
  expect(await fontSizeOf(reloaded)).toBe(enlarged)

  await other.getByTestId('bible-font-decrease').click()
  await other.getByTestId('bible-font-decrease').click()
  await expect.poll(() => fontSizeOf(reloaded)).toBe(original)
})

test('the smallest size disables A↓', async ({ page }) => {
  await walkToJohn3(page)

  const decrease = page.getByTestId('bible-font-decrease')
  // 1.0 down to 0.8 in steps of 0.1.
  await decrease.click()
  await decrease.click()
  await expect(decrease).toBeDisabled()
  await expect(page.getByTestId('bible-font-increase')).toBeEnabled()
})
