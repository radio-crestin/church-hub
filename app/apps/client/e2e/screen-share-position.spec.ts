import { expect, test } from '@playwright/test'

/**
 * A screen's "Screen share" layout places the shared video by its edge
 * constraints (left/top/right/bottom, in px or %). The projection must use
 * them, not fill the screen.
 *
 * The share is started the way the operator's app starts it: a
 * `screen_share_start` message on the app's WebSocket. No real stream is
 * needed; the projection shows the video's frame while it waits for one.
 */

const edge = (value: number, unit: 'px' | '%') => ({
  enabled: true,
  value,
  unit,
})

test('a screen share is placed by its edge constraints', async ({
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
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(
            `${location.origin.replace(/^http/, 'ws')}/ws`,
          )
          ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'screen_share_start', payload: {} }))
            resolve()
          }
          ws.onerror = () => reject(new Error('WebSocket failed'))
          ;(window as unknown as { __shareSocket: WebSocket }).__shareSocket =
            ws
        }),
    )

    const projection = await browser.newPage({
      viewport: { width: 1000, height: 500 },
    })
    await projection.goto(`/screen/${screenId}`)
    const frame = projection.locator('video').locator('..')
    await expect(frame).toBeVisible({ timeout: 15_000 })

    const box = await frame.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round(box?.y ?? 0)).toBe(40)
    expect(Math.round(box?.height ?? 0)).toBe(500 - 80)
    expect(Math.round(box?.x ?? 0)).toBe(100)
    expect(Math.round(box?.width ?? 0)).toBe(1000 - 200)
    await projection.close()
  } finally {
    await page
      .evaluate(() => {
        const ws = (window as unknown as { __shareSocket?: WebSocket })
          .__shareSocket
        ws?.send(JSON.stringify({ type: 'screen_share_stop' }))
        ws?.close()
      })
      .catch(() => undefined)
    await request
      .post('/api/presentation/clear-temporary')
      .catch(() => undefined)
    await request.delete(`/api/screens/${screenId}`)
  }
})
