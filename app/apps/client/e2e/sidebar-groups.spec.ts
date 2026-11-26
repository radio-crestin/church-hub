import { expect, type Page, test } from '@playwright/test'

/**
 * The sidebar groups its pages under Live / Library / Tools (În desfășurare /
 * Resurse / Instrumente), and Settings > Sidebar moves a page to another
 * group.
 */

const sidebar = (page: Page) => page.getByTestId('main-sidebar')
const group = (page: Page, name: RegExp) =>
  sidebar(page).getByRole('region', { name })
const LIVE = /^(Live|În desfășurare)$/
const LIBRARY = /^(Library|Resurse)$/
const TOOLS = /^(Tools|Instrumente)$/
const MUSIC = /^(Music|Muzică)/

async function moveMusicTo(page: Page, groupId: 'library' | 'tools') {
  await page.goto('/settings/sidebar')
  const select = page.getByTestId('sidebar-item-group-music')
  await expect(select).toBeVisible({ timeout: 15000 })
  await select.selectOption(groupId)
  await expect(select).toHaveValue(groupId)
}

test.describe('Sidebar groups', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await moveMusicTo(page, 'library')
    await page.close()
  })

  test('pages sit in their default groups', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/songs')
    await expect(
      group(page, LIVE).getByRole('link', { name: /Control|Camera/ }),
    ).toBeVisible({ timeout: 15000 })
    await expect(
      group(page, LIBRARY).getByRole('link', { name: MUSIC }),
    ).toBeVisible()
  })

  test('Settings > Sidebar moves a page to another group', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await moveMusicTo(page, 'tools')

    await expect(
      group(page, TOOLS).getByRole('link', { name: MUSIC }),
    ).toBeVisible()
    await expect(
      group(page, LIBRARY).getByRole('link', { name: MUSIC }),
    ).toHaveCount(0)

    // The footer pages are in no group, so they have no group choice.
    await expect(page.getByTestId('sidebar-item-group-settings')).toHaveCount(0)
  })
})
