import { expect, type Page, test, type WebSocketRoute } from '@playwright/test'

/**
 * A screen loads the presentation state over HTTP, then opens its WebSocket.
 * A slide change made in between was broadcast before the screen listened,
 * so it kept the old slide until the 10 s poll. On Windows the socket opens
 * late enough for an operator's Next right after showing a song to land in
 * that gap (T-150).
 */

const FIRST_LYRIC = 'Late socket first slide'
const SECOND_LYRIC = 'Late socket second slide'

/** Holds the page's sockets unconnected to the server until `release`. */
async function holdSockets(page: Page) {
  const held: WebSocketRoute[] = []
  let released = false
  await page.routeWebSocket(/\/ws$/, (ws) => {
    if (released) ws.connectToServer()
    else held.push(ws)
  })
  return {
    release() {
      released = true
      for (const ws of held) ws.connectToServer()
    },
  }
}

test('a screen whose socket opens late still shows the slide changed meanwhile', async ({
  page,
  request,
}) => {
  const screen = await request.post('/api/screens', {
    data: { name: `E2E LateSocket ${Date.now()}`, type: 'primary' },
  })
  expect(screen.ok()).toBeTruthy()
  const screenId = (await screen.json()).data.id as number

  const song = await request.post('/api/songs', {
    data: {
      title: `E2E LateSocket ${Date.now()}`,
      slides: [FIRST_LYRIC, SECOND_LYRIC].map((text, i) => ({
        content: `<p>${text}</p>`,
        sortOrder: i,
      })),
    },
  })
  expect(song.status()).toBe(201)
  const songId = (await song.json()).data.id as number

  try {
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    const sockets = await holdSockets(page)
    await page.goto(`/screen/${screenId}`)
    await expect(page.getByText(FIRST_LYRIC).last()).toBeVisible({
      timeout: 15000,
    })

    const next = await request.post('/api/presentation/navigate-temporary', {
      data: { direction: 'next', requestTimestamp: Date.now() },
    })
    expect(next.ok()).toBeTruthy()
    sockets.release()

    // Well under the 10 s poll that used to be the only way to catch up.
    await expect(page.getByText(SECOND_LYRIC).last()).toBeVisible({
      timeout: 3000,
    })
  } finally {
    await request.post('/api/presentation/stop')
    await request.delete(`/api/songs/${songId}`)
    await request.delete(`/api/screens/${screenId}`)
  }
})
