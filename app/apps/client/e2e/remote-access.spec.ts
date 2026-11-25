import { expect, type Page, test } from '@playwright/test'

import { startFakeSignalingRelay } from './helpers/fake-signaling-relay'
import { FAKE_RELAY_URL } from '../playwright.config'

/**
 * Remote access (CH-050): with "Reach this computer from anywhere" on in
 * Settings > Phones, the pairing code also carries the computer's room on the
 * signaling relay, and a paired phone app that can't reach the computer's
 * address (away from the church Wi-Fi) connects over WebRTC instead: its
 * requests and its WebSocket go through the tunnel, signed in as its own
 * account and never taken for the computer itself.
 */

// Chromium hides its host addresses behind mDNS names the computer's WebRTC
// peer can't resolve; a real phone away from the church connects by its
// public (STUN) address instead.
test.use({
  launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] },
})

const PHONE = { width: 390, height: 844 }
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
/** The computer's address on the church Wi-Fi, out of reach from here. */
const UNREACHABLE_COMPUTER = 'http://127.0.0.1:9'

let stopRelay: () => void
test.beforeAll(async () => {
  stopRelay = await startFakeSignalingRelay()
})
test.afterAll(() => stopRelay())

async function setRemoteAccess(page: Page, enabled: boolean) {
  const res = await page.request.put('/api/remote-access', {
    data: { enabled },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()).data as { secret: string; relay: string }
}

test.describe('Remote access', () => {
  test.afterEach(async ({ page }) => {
    await setRemoteAccess(page, false)
  })

  test('the switch puts the computer’s room in the pairing code', async ({
    page,
  }) => {
    await setRemoteAccess(page, false)
    await page.goto('/settings/phones')
    const qr = page.getByTestId('pairing-qr')
    await expect(qr).toBeVisible()
    expect(await qr.getAttribute('data-url')).not.toContain('#remote=')

    await page.getByTestId('remote-access-switch').click()
    await expect(qr).toHaveAttribute(
      'data-url',
      new RegExp(
        `#remote=[\\w-]+&relay=${encodeURIComponent(FAKE_RELAY_URL).replace(/\./g, '\\.')}`,
      ),
    )
  })

  test('a phone away from the church Wi-Fi reaches the computer over WebRTC', async ({
    page,
    browser,
  }) => {
    const room = await setRemoteAccess(page, true)
    const name = `Remote phone ${Date.now()}`
    const created = await page.request.post('/api/users', {
      data: { name, permissions: ['songs.view', 'control_room.view'] },
    })
    const { data } = await created.json()
    try {
      const phone = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        viewport: PHONE,
        userAgent: IPHONE_UA,
      })
      const app = await phone.newPage()
      // The paired Church Hub app on an iPhone, its HTTP client doing real
      // requests (the computer's Wi-Fi address refuses: it is away).
      await app.addInitScript(
        ({ computer, token, pairing }) => {
          localStorage.setItem('church-hub-api-url', computer)
          localStorage.setItem('church-hub-user-auth', token)
          localStorage.setItem(
            'church-hub-remote-pairing',
            JSON.stringify(pairing),
          )
          const requests = new Map<number, { url: string; init: RequestInit }>()
          const bodies = new Map<number, Uint8Array>()
          let nextRid = 1
          Object.assign(window, {
            __TAURI_INTERNALS__: {
              metadata: {
                currentWindow: { label: 'main' },
                currentWebview: { windowLabel: 'main', label: 'main' },
              },
              transformCallback: () => 0,
              unregisterCallback: () => undefined,
              convertFileSrc: (path: string) => path,
              invoke: async (
                command: string,
                args?: Record<string, unknown>,
              ) => {
                if (command === 'plugin:http|fetch') {
                  const config = args?.clientConfig as {
                    url: string
                    method: string
                    headers: Array<[string, string]>
                    data?: number[]
                  }
                  const rid = nextRid++
                  requests.set(rid, {
                    url: config.url,
                    init: {
                      method: config.method,
                      headers: config.headers,
                      body: config.data
                        ? new Uint8Array(config.data)
                        : undefined,
                    },
                  })
                  return rid
                }
                if (command === 'plugin:http|fetch_send') {
                  const request = requests.get(args?.rid as number)
                  if (!request) throw new Error('unknown request')
                  const res = await fetch(request.url, request.init)
                  const rid = nextRid++
                  bodies.set(rid, new Uint8Array(await res.arrayBuffer()))
                  const headers: Array<[string, string]> = []
                  res.headers.forEach((value, key) =>
                    headers.push([key, value]),
                  )
                  return {
                    status: res.status,
                    statusText: res.statusText,
                    url: request.url,
                    headers,
                    rid,
                  }
                }
                if (command === 'plugin:http|fetch_read_body') {
                  // The plugin's body stream: chunks end in 0, the end is [1].
                  const channel = args?.streamChannel as {
                    onmessage: (chunk: Uint8Array) => void
                  }
                  const body =
                    bodies.get(args?.rid as number) ?? new Uint8Array()
                  channel.onmessage(Uint8Array.from([...body, 0]))
                  channel.onmessage(Uint8Array.from([1]))
                  return null
                }
                return null
              },
            },
          })
        },
        {
          computer: UNREACHABLE_COMPUTER,
          token: data.token as string,
          pairing: { relay: room.relay, secret: room.secret },
        },
      )
      await app.goto('/')

      // Requests reach the computer through the tunnel, as the phone's account…
      const me = () =>
        app
          .evaluate(async (computer) => {
            const res = await fetch(`${computer}/api/auth/me`)
            return ((await res.json()) as { data: { name: string } | null })
              .data?.name
          }, UNREACHABLE_COMPUTER)
          .catch(() => null)
      await expect.poll(me, { timeout: 30_000 }).toBe(name)

      // …from elsewhere, never the computer itself: no localhost-only routes.
      const systemToken = await app.evaluate(async (computer) => {
        const res = await fetch(`${computer}/api/system-token`)
        return { status: res.status, body: await res.json() }
      }, UNREACHABLE_COMPUTER)
      expect(systemToken).toEqual({
        status: 403,
        body: { error: 'Only accessible from localhost' },
      })
      await phone.close()
    } finally {
      await page.request.delete(`/api/users/${data.user.id}`)
    }
  })
})
