import { expect, test } from '@playwright/test'

import {
  makeJpeg,
  readCenterPixel,
  startFrameFeed,
  startShare,
  stopShare,
} from './helpers/screenShare'

/**
 * A screen's "Screen share" layout places the shared screen by its edge
 * constraints (left/top/right/bottom, in px or %). The projection must use
 * them, not fill the screen.
 *
 * The share is started and fed the way the desktop app does it: POST
 * /api/screen-share/start, then JPEG frames to /api/screen-share/frame with
 * its token. A browser screen shows them from the MJPEG stream.
 */

const edge = (value: number, unit: 'px' | '%') => ({
  enabled: true,
  value,
  unit,
})

test('a screen share is placed by its edge constraints and shows the frames', async ({
  page,
  browser,
  request,
}) => {
  const created = await request.post('/api/screens', {
    data: { name: `E2E Share ${Date.now()}`, type: 'primary' },
  })
  const screenId = (await created.json()).data.id as number

  try {
    const screen = (
      await (await request.get(`/api/screens/${screenId}`)).json()
    ).data
    const shareConfig = screen.contentConfigs.screen_share
    await request.put(`/api/screens/${screenId}/config/screen_share`, {
      data: {
        config: {
          ...shareConfig,
          videoElement: {
            ...shareConfig.videoElement,
            constraints: {
              left: edge(10, '%'),
              top: edge(40, 'px'),
              right: edge(10, '%'),
              bottom: edge(40, 'px'),
            },
          },
        },
      },
    })

    await page.goto('/')
    const red = await makeJpeg(page, '#e01010')
    const token = await startShare(request)
    const feed = startFrameFeed(request, token, red)

    try {
      const projection = await browser.newPage({
        viewport: { width: 1000, height: 500 },
      })
      await projection.goto(`/screen/${screenId}`)
      const view = projection.getByTestId('screen-share-view')
      await expect(view).toBeVisible({ timeout: 15_000 })

      const box = await view.boundingBox()
      expect(box).not.toBeNull()
      expect(Math.round(box?.y ?? 0)).toBe(40)
      expect(Math.round(box?.height ?? 0)).toBe(500 - 80)
      expect(Math.round(box?.x ?? 0)).toBe(100)
      expect(Math.round(box?.width ?? 0)).toBe(1000 - 200)

      // The browser screen draws the frames from the stream: red arrives.
      const stream = view.locator('img')
      await expect
        .poll(() => readCenterPixel(stream), { timeout: 15_000 })
        .toEqual(expect.objectContaining({ isRed: true }))
      await expect(view.locator('[data-renderer="stream"]')).toBeVisible()

      // Stopping takes it off the screen.
      await stopShare(request)
      await expect(view).toBeHidden({ timeout: 10_000 })
      await projection.close()
    } finally {
      feed.stop()
    }
  } finally {
    await stopShare(request).catch(() => undefined)
    await request.delete(`/api/screens/${screenId}`)
  }
})
