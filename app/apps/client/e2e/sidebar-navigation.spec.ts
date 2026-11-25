import { expect, test } from '@playwright/test'

/** The main sidebar takes the user to each of the app's main pages. */
test('the sidebar opens Songs, Bible, Programs and Settings', async ({
  page,
}) => {
  await page.goto('/')
  const sidebar = page.getByTestId('main-sidebar')
  for (const path of ['/songs', '/bible', '/schedules', '/settings']) {
    await sidebar.locator(`a[href="${path}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`${path}(/|$|\\?)`))
  }
})
