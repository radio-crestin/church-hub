import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { clearNotifications } from './helpers/song-folder-source'

/**
 * Notifications in the sidebar are a bell on the Settings row, at its right
 * end, with a dot (no number) while something is unread; it opens the
 * notifications page. Also in the collapsed sidebar and on a phone.
 */

const SHOTS_DIR = process.env.SHOTS_DIR

const bellOf = (page: Page) => page.getByTestId('sidebar-notifications-bell')
const dotOf = (page: Page) => page.getByTestId('sidebar-notifications-dot')
const settingsOf = (page: Page) =>
  page
    .getByTestId('main-sidebar')
    .getByRole('link', { name: /^(Settings|Setări)$/ })

async function addUnread(request: APIRequestContext) {
  await clearNotifications(request)
  const res = await request.post('/api/notifications/app-update', {
    data: { version: '99.0.0' },
  })
  expect(res.ok()).toBe(true)
}

async function closePopUp(page: Page) {
  const popup = page.getByTestId('notification-popup')
  await expect(popup).toBeVisible()
  await popup.getByRole('button', { name: /^(Close|Închide)$/ }).click()
  await expect(popup).toHaveCount(0)
}

async function shot(page: Page, name: string) {
  if (SHOTS_DIR) await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` })
}

async function expectBellRightOfSettings(page: Page) {
  const bell = await bellOf(page).boundingBox()
  const settings = await settingsOf(page).boundingBox()
  if (!bell || !settings) throw new Error('bell or Settings not laid out')
  const bellMiddle = bell.y + bell.height / 2
  expect(bellMiddle).toBeGreaterThan(settings.y)
  expect(bellMiddle).toBeLessThan(settings.y + settings.height)
  expect(bell.x).toBeGreaterThanOrEqual(settings.x + settings.width - 1)
}

test.describe('Sidebar notifications bell', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ request }) => {
    await clearNotifications(request)
  })

  test('a bell with a dot on the Settings row opens the notifications', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await addUnread(request)
    await page.goto('/songs')
    await closePopUp(page)

    await expect(bellOf(page)).toBeVisible()
    await expect(bellOf(page)).toHaveAccessibleName(/notific/i)
    await expect(bellOf(page)).not.toContainText(/\S/)
    await expect(dotOf(page)).toBeVisible()
    await expect(dotOf(page)).not.toContainText(/\S/)
    await expect(
      page
        .getByTestId('main-sidebar')
        .getByText(/^(Notifications|Notificări)$/),
    ).toHaveCount(0)
    await expectBellRightOfSettings(page)
    await shot(page, 'after-unread')

    await bellOf(page).click()
    await expect(page).toHaveURL(/\/notifications$/)
    await expect(bellOf(page)).toHaveAttribute('aria-current', 'page')
    await expect(dotOf(page)).toHaveCount(0)
    await shot(page, 'after-read')
  })

  test('works in the collapsed sidebar', async ({ page, request }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await addUnread(request)
    await page.goto('/songs')
    await closePopUp(page)
    await page.getByTestId('sidebar-collapse-toggle').click()
    await expect(page.getByTestId('main-sidebar')).toHaveAttribute(
      'data-collapsed',
      'true',
    )

    await expect(bellOf(page)).toBeVisible()
    await expect(dotOf(page)).toBeVisible()
    await shot(page, 'after-collapsed')
    await bellOf(page).click()
    await expect(page).toHaveURL(/\/notifications$/)
    await page.getByTestId('sidebar-collapse-toggle').click()
  })

  test('works in the phone menu', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await addUnread(request)
    await page.goto('/songs')
    await closePopUp(page)
    await page
      .getByRole('button', { name: /^(Open menu|Deschide meniu)$/ })
      .click()
    // The drawer slides in: measure once it is in place.
    await expect
      .poll(
        async () => (await page.getByTestId('main-sidebar').boundingBox())?.x,
      )
      .toBe(0)

    await expect(bellOf(page)).toBeVisible()
    await expect(dotOf(page)).toBeVisible()
    await expectBellRightOfSettings(page)
    await shot(page, 'after-mobile')
    await bellOf(page).click()
    await expect(page).toHaveURL(/\/notifications$/)
  })
})
