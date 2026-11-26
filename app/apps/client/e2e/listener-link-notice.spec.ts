import { expect, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'

/**
 * After the update that gave the listener link a new address, the dashboard's
 * Live Translation card says so once, above the new link, until dismissed.
 */

const FLAG = 'live_translation_link_changed'

test.beforeEach(async ({ page }) => {
  await setAppLanguage(page, 'en')
})

test.afterEach(async ({ request }) => {
  await request.delete('/api/live-translation/link-changed')
})

test('the card tells once that the listener link changed', async ({
  page,
  request,
}) => {
  const set = await request.post('/api/settings/app_settings', {
    data: { key: FLAG, value: 'true' },
  })
  expect(set.ok()).toBe(true)

  await page.goto('/dashboard')
  const notice = page.getByTestId('listener-link-changed')
  await expect(notice).toContainText('Your listener link changed')
  await expect(page.locator('input[value*="/listen/h1"]')).toBeVisible()

  await notice.getByRole('button', { name: 'Dismiss' }).click()
  await expect(notice).toBeHidden()
  await page.reload()
  await expect(page.locator('input[value*="/listen/h1"]')).toBeVisible()
  await expect(notice).toBeHidden()
})

test('a new install shows no notice', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.locator('input[value*="/listen/h1"]')).toBeVisible()
  await expect(page.getByTestId('listener-link-changed')).toBeHidden()
})
