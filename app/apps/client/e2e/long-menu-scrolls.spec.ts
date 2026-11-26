import { expect, type Page, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'

/**
 * A long ⋮ menu stays on screen and scrolls (CH-212): with 20 playlists, a
 * track's menu lists "Add to …" for each, and the last one can still be
 * picked, on a desktop and on a phone.
 */

const COUNT = 20

interface Playlist {
  id: number
  name: string
}

async function expectPanelOnScreen(page: Page) {
  const panel = page.getByRole('menu')
  const box = (await panel.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
}

for (const [device, viewport] of [
  ['desktop', { width: 1280, height: 720 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test(`the last of ${COUNT} playlists is picked from the track menu on a ${device}`, async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const playlists: Playlist[] = []
    for (let n = 1; n <= COUNT; n++) {
      const response = await request.post('/api/music/playlists', {
        data: { name: `Many ${stamp} ${String(n).padStart(2, '0')}` },
      })
      playlists.push(((await response.json()) as { data: Playlist }).data)
    }
    const last = playlists[COUNT - 1]

    try {
      await setAppLanguage(page, 'en')
      await page.setViewportSize(viewport)
      await page.goto('/music')
      const rows = page.getByTestId('music-track-row')
      await expect(rows.first()).toBeVisible({ timeout: 20_000 })

      // The bottom row's menu has the least room below it.
      await rows.last().getByTestId('music-track-menu').click()
      await expectPanelOnScreen(page)
      await page.getByTestId(`music-add-to-playlist-${last.id}`).click()
      await expect(page.getByRole('menu')).toHaveCount(0)

      const response = await request.get(`/api/music/playlists/${last.id}`)
      const { data } = (await response.json()) as {
        data: { items: unknown[] }
      }
      expect(data.items).toHaveLength(1)
    } finally {
      for (const playlist of playlists) {
        await request.delete(`/api/music/playlists/${playlist.id}`)
      }
    }
  })
}
