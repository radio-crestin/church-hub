import { expect, type Page, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'

/**
 * "Add to playlist" opens a searchable picker (CH-212): with 20 playlists the
 * last one can still be scrolled to and picked, and a search narrows the list,
 * on a desktop and on a phone.
 */

const COUNT = 20

interface Playlist {
  id: number
  name: string
}

async function itemCount(page: Page, playlistId: number) {
  const response = await page.request.get(`/api/music/playlists/${playlistId}`)
  const { data } = (await response.json()) as { data: { items: unknown[] } }
  return data.items.length
}

for (const [device, viewport] of [
  ['desktop', { width: 1280, height: 720 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test(`the ${COUNT} playlists are picked and searched in the picker on a ${device}`, async ({
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
    const [first] = playlists
    const last = playlists[COUNT - 1]

    try {
      await setAppLanguage(page, 'en')
      await page.setViewportSize(viewport)
      await page.goto('/music')
      const rows = page.getByTestId('music-track-row')
      await expect(rows.first()).toBeVisible({ timeout: 20_000 })
      const picker = page.getByTestId('music-playlist-picker')

      // The last of a long list: the picker fits the screen and scrolls to it.
      await rows.last().getByTestId('music-track-menu').click()
      await page.getByTestId('music-add-to-playlist').click()
      await expect(picker).toBeVisible()
      const box = (await picker.boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
      await picker.getByTestId(`music-add-to-playlist-${last.id}`).click()
      await expect(picker).toBeHidden()
      await expect.poll(() => itemCount(page, last.id)).toBe(1)

      // A search narrows it to one, and Enter files the track there.
      await rows.first().getByTestId('music-track-menu').click()
      await page.getByTestId('music-add-to-playlist').click()
      await picker.getByRole('textbox').fill(`${stamp} 01`)
      await expect(picker.getByRole('button', { name: /^Many/ })).toHaveCount(1)
      await picker.getByRole('textbox').press('Enter')
      await expect(picker).toBeHidden()
      await expect.poll(() => itemCount(page, first.id)).toBe(1)
      await expect(page.getByRole('menu')).toHaveCount(0)

      // Nothing matching says so.
      await rows.first().getByTestId('music-track-menu').click()
      await page.getByTestId('music-add-to-playlist').click()
      await picker.getByRole('textbox').fill('no such playlist')
      await expect(picker).toContainText('No playlist matches')
      await page.keyboard.press('Escape')
      await expect(picker).toBeHidden()
    } finally {
      for (const playlist of playlists) {
        await request.delete(`/api/music/playlists/${playlist.id}`)
      }
    }
  })
}
