import { expect, type Page, test } from '@playwright/test'

/**
 * With no OBS password saved yet, the OBS settings page proposes one: long,
 * from a crypto RNG, and different on every load.
 */

async function proposedPassword(page: Page): Promise<string> {
  await page.goto('/livestream/obs')
  const code = page.getByTestId('obs-settings-access').locator('code')
  await expect(code).toHaveText(/^[A-Za-z0-9]{16,}$/)
  return (await code.textContent()) ?? ''
}

test('the OBS settings page proposes a fresh 16+ char password on each load', async ({
  page,
}) => {
  await page.route('**/api/livestream/obs/config', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          json: {
            data: {
              host: 'localhost',
              port: 4455,
              password: '',
              autoConnect: false,
            },
          },
        })
      : route.continue(),
  )

  const first = await proposedPassword(page)
  const second = await proposedPassword(page)
  expect(first.length).toBeGreaterThanOrEqual(16)
  expect(second).not.toBe(first)
})
