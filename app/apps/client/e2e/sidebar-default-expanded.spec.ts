import { expect, type Page, test } from '@playwright/test'

/**
 * The main sidebar on a fresh install (empty storage) starts expanded, and a
 * user's own choice to collapse or expand it is remembered across reloads.
 */

const COLLAPSED_KEY = 'sidebar-collapsed'
const EXPANDED_MIN_WIDTH = 200

const sidebarOf = (page: Page) => page.getByTestId('main-sidebar')
const toggleOf = (page: Page) => page.getByTestId('sidebar-collapse-toggle')

const savedChoice = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), COLLAPSED_KEY)

async function openWithEmptyStorage(page: Page) {
  await page.goto('/')
  await expect(sidebarOf(page)).toBeVisible()
  expect(await savedChoice(page)).toBeNull()
}

async function expectExpanded(page: Page) {
  await expect(sidebarOf(page)).toHaveAttribute('data-collapsed', 'false')
  await expect
    .poll(async () => (await sidebarOf(page).boundingBox())?.width ?? 0)
    .toBeGreaterThan(EXPANDED_MIN_WIDTH)
}

async function expectCollapsed(page: Page) {
  await expect(sidebarOf(page)).toHaveAttribute('data-collapsed', 'true')
  await expect
    .poll(async () => (await sidebarOf(page).boundingBox())?.width ?? 0)
    .toBeLessThan(EXPANDED_MIN_WIDTH)
}

test.describe('Main sidebar default', () => {
  test('starts expanded on a fresh install and does not save the default', async ({
    page,
  }) => {
    await openWithEmptyStorage(page)
    await expectExpanded(page)

    await page.reload()
    await expect(sidebarOf(page)).toBeVisible()
    await expectExpanded(page)
    expect(await savedChoice(page)).toBeNull()
  })

  test('remembers a collapse after a reload', async ({ page }) => {
    await openWithEmptyStorage(page)

    await toggleOf(page).click()
    await expectCollapsed(page)

    await page.reload()
    await expect(sidebarOf(page)).toBeVisible()
    await expectCollapsed(page)
  })

  test('remembers an expand after a collapse and a reload', async ({
    page,
  }) => {
    await openWithEmptyStorage(page)

    await toggleOf(page).click()
    await expectCollapsed(page)
    await toggleOf(page).click()
    await expectExpanded(page)

    await page.reload()
    await expect(sidebarOf(page)).toBeVisible()
    await expectExpanded(page)
  })
})
