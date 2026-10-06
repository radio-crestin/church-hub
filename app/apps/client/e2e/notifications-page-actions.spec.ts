import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { clearNotifications } from './helpers/song-folder-source'

/**
 * The notifications page header: "Mark all as read" takes the new mark off
 * every notification; "Clear all" removes them all, after an in-app confirm.
 */

const SHOTS_DIR = process.env.SHOTS_DIR

async function shot(page: Page, name: string) {
  if (!SHOTS_DIR) return
  await page.screenshot({
    path: `${SHOTS_DIR}/${name}.png`,
    animations: 'disabled',
  })
}

async function addTwo(request: APIRequestContext) {
  await clearNotifications(request)
  for (const version of ['99.0.0', '99.0.1']) {
    const res = await request.post('/api/notifications/app-update', {
      data: { version },
    })
    expect(res.ok()).toBe(true)
  }
}

async function listed(request: APIRequestContext) {
  const res = await request.get('/api/notifications')
  return (await res.json()).data as { id: string; readAt: number | null }[]
}

test.describe('Notifications page actions', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ request }) => {
    await clearNotifications(request)
  })

  test('mark all as read takes the new mark off every notification', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await addTwo(request)
    await page.goto('/notifications')

    const cards = page.locator('[data-new]')
    await expect(cards).toHaveCount(2)
    const markAll = page.getByTestId('notifications-mark-all-read')
    await expect(markAll).toHaveAccessibleName(
      /^(Mark all as read|Marchează toate ca citite)$/,
    )
    await shot(page, 'after-actions')

    await markAll.click()
    await expect(cards).toHaveCount(0)
    await expect(markAll).toBeDisabled()
    for (const n of await listed(request)) expect(n.readAt).not.toBeNull()
    await shot(page, 'after-marked')
  })

  test('clear all asks in the app first, then removes them all', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await addTwo(request)
    page.on('dialog', () => {
      throw new Error('Clear all must not use a browser dialog')
    })
    await page.goto('/notifications')
    const panel = page.getByTestId('notifications-panel')
    await expect(panel).toContainText('99.0.1')

    const clearAll = page.getByTestId('notifications-clear-all')
    const confirm = page.getByTestId('notifications-clear-all-confirm')

    // Cancelled: nothing removed.
    await clearAll.click()
    await expect(confirm).toBeVisible()
    await shot(page, 'after-clear-confirm')
    await confirm.getByRole('button', { name: /^(Cancel|Anulează)$/ }).click()
    await expect(confirm).toBeHidden()
    expect(await listed(request)).toHaveLength(2)

    // Confirmed: all gone.
    await clearAll.click()
    await confirm
      .getByRole('button', { name: /^(Clear all|Șterge toate)$/ })
      .click()
    await expect(panel).toContainText(
      /No notifications yet|Nu ai încă notificări/,
    )
    expect(await listed(request)).toHaveLength(0)
    await expect(clearAll).toBeDisabled()
    await expect(page.getByTestId('notifications-mark-all-read')).toBeDisabled()
    await shot(page, 'after-cleared')
  })
})
