import { expect, test } from '@playwright/test'

/**
 * The Backup page says where the key sealing saved passwords and keys is
 * kept (the suite keeps it in a file). After a restore from another
 * computer, the Backup and Developer pages list what to set up again, each
 * a link to its page, until it is dismissed.
 */

test('the backup page says where the key is kept', async ({ page }) => {
  await page.goto('/settings/backup')
  const status = page.getByTestId('secret-store-status')
  await expect(status.locator('[data-kept-in="file"]')).toBeVisible()
  await expect(page.getByTestId('secret-store-reset')).toHaveCount(0)
})

test('after a restore from another computer it lists what to set up again, one tap each', async ({
  page,
}) => {
  let resetFeatures = ['obs', 'youtube', 'users']
  await page.route('**/api/secret-store', (route) =>
    route.fulfill({
      json: { data: { keptIn: 'file', locked: false, resetFeatures } },
    }),
  )
  await page.route('**/api/secret-store/reset-features', (route) => {
    resetFeatures = []
    return route.fulfill({ json: { data: { success: true } } })
  })

  // Where a database import runs, too.
  await page.goto('/settings/developer')
  await expect(page.getByTestId('secret-store-reset')).toBeVisible()

  await page.goto('/settings/backup')
  const reset = page.getByTestId('secret-store-reset')
  await expect(reset.locator('[data-feature]')).toHaveCount(3)
  await expect(reset.locator('[data-feature="obs"]')).toHaveAttribute(
    'href',
    '/livestream/obs',
  )
  await expect(reset.locator('[data-feature="users"]')).toHaveAttribute(
    'href',
    '/settings/users',
  )
  await reset.locator('[data-feature="youtube"]').click()
  await expect(page).toHaveURL(/\/livestream\/youtube/)

  await page.goto('/settings/backup')
  await reset.getByRole('button').click()
  await expect(reset).toHaveCount(0)
})
