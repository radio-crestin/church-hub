import { expect, type Page, test } from '@playwright/test'

import { clearNotifications } from './helpers/song-folder-source'

/**
 * The notifications page follows the page layout standard
 * (docs/page-layout.md): the same title as the songs page, full width, its
 * list on a panel, an empty state while there is nothing.
 */

const SHOTS_DIR = process.env.SHOTS_DIR

async function shot(page: Page, name: string) {
  if (!SHOTS_DIR) return
  await page.screenshot({
    path: `${SHOTS_DIR}/${name}.png`,
    animations: 'disabled',
  })
}

async function titleBox(page: Page, name: RegExp) {
  const title = page.getByRole('heading', { level: 1, name })
  await expect(title).toBeVisible()
  const box = await title.boundingBox()
  const fontSize = await title.evaluate((el) => getComputedStyle(el).fontSize)
  return { x: box?.x, y: box?.y, fontSize }
}

test.describe('Notifications page layout', () => {
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ request }) => {
    await clearNotifications(request)
  })

  test('lays out like the songs page', async ({ page, request }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await clearNotifications(request)
    await request.post('/api/notifications/app-update', {
      data: { version: '99.0.0' },
    })

    await page.goto('/songs')
    const songsTitle = await titleBox(page, /^(Songs|Cântări)$/)

    await page.goto('/notifications')
    const title = await titleBox(page, /^(Notifications|Notificări)$/)
    expect(title.x).toBe(songsTitle.x)
    expect(title.fontSize).toBe(songsTitle.fontSize)
    // Songs centres its title against its buttons: a few pixels lower.
    expect(Math.abs((title.y ?? 0) - (songsTitle.y ?? 0))).toBeLessThan(5)

    const panel = page.getByTestId('notifications-panel')
    await expect(panel).toContainText(/99\.0\.0/)
    const panelBox = await panel.boundingBox()
    if (!panelBox) throw new Error('panel not laid out')
    // Full width, under the title: no centred column.
    expect(Math.abs(panelBox.x - (songsTitle.x ?? 0))).toBeLessThan(2)
    expect(panelBox.width).toBeGreaterThan(1200)
    await shot(page, 'after-page')

    // On a phone: no sideways scroll.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(panel).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await shot(page, 'after-page-mobile')
  })

  test('shows the shared empty state when there is nothing', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await clearNotifications(request)
    await page.goto('/notifications')
    await expect(page.getByTestId('notifications-panel')).toContainText(
      /No notifications yet|Nu ai încă notificări/,
    )
    await shot(page, 'after-empty')
  })
})
