import { expect, test } from '@playwright/test'

/**
 * T-160: a scene's settings open on their own page (no popup), which goes
 * back to the scene list when saved.
 */
test("a scene's settings are a page of their own", async ({ page }) => {
  await page.goto('/settings/livestream')
  const settingsLink = page
    .getByRole('link', { name: /^(Scene Settings|Setările scenei)$/ })
    .first()
  await settingsLink.click()
  await expect(page).toHaveURL(/\/livestream\/scenes\/\d+$/)
  await expect(page.getByTestId('scene-settings-page')).toBeVisible()

  const name = page.locator('#displayName')
  const original = await name.inputValue()
  await name.fill(`${original} e2e`)
  await page.getByRole('button', { name: /^(Save|Salvează)$/ }).click()
  await expect(page).toHaveURL(/\/settings\/livestream$/)
  await expect(page.getByText(`${original} e2e`, { exact: true })).toBeVisible()

  // Put the name back, leaving the shared test database as it was.
  await settingsLink.click()
  await page.locator('#displayName').fill(original)
  await page.getByRole('button', { name: /^(Save|Salvează)$/ }).click()
  await expect(page).toHaveURL(/\/settings\/livestream$/)
  await expect(page.getByText(original, { exact: true }).first()).toBeVisible()
})
