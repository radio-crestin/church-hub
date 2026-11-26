import { expect, test } from '@playwright/test'

/**
 * The Backup page says where the key sealing saved passwords and keys is
 * kept (the suite keeps it in a file), and after a restore from another
 * computer lists what to set up again until it is dismissed.
 */

test('the backup page says where the key is kept', async ({ page }) => {
  await page.goto('/settings/backup')
  const status = page.getByTestId('secret-store-status')
  await expect(status.locator('[data-kept-in="file"]')).toBeVisible()
  await expect(page.getByTestId('secret-store-reset')).toHaveCount(0)
})

test('after a restore from another computer it lists what to set up again', async ({
  page,
}) => {
  let resetFeatures = ['obs', 'youtube']
  await page.route('**/api/secret-store', (route) =>
    route.fulfill({
      json: { data: { keptIn: 'file', locked: false, resetFeatures } },
    }),
  )
  await page.route('**/api/secret-store/reset-features', (route) => {
    resetFeatures = []
    return route.fulfill({ json: { data: { success: true } } })
  })

  await page.goto('/settings/backup')
  const reset = page.getByTestId('secret-store-reset')
  await expect(reset.locator('[data-feature]')).toHaveCount(2)
  await expect(reset.locator('[data-feature="youtube"]')).toBeVisible()
  await reset.getByRole('button').click()
  await expect(reset).toHaveCount(0)
})
