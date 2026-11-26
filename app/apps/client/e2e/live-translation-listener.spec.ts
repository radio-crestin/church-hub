import { createHash } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'

import { startSignalingRelay } from './helpers/signaling-relay'
import { SIGNALING_RELAY_URL } from '../playwright.config'

/**
 * Live translation's listener link (/listen/<id>, served by the relay): a
 * listener joins with the room id alone and hears the host. For a hosted
 * room the host's calls need the host key the computer keeps to itself; a
 * released app's room (32-character id, no key) works as it always has. The
 * host here is a page doing what the computer does (startSignalingRelay.ts):
 * register, take the offers, answer them, send languages and text.
 */

// Chromium hides host addresses behind mDNS names; connect by address.
test.use({
  launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] },
})

const HOST_KEY = 'e2e-host-key-0123456789abcdefghijklmnopqrstu'
/** The hosted room's id: "h1" + SHA-256 of its key (hostedRoom.ts). */
const ROOM = `h1${createHash('sha256').update(HOST_KEY).digest('base64url')}`
/** A room id as the released apps make it, hosted without a key. */
const OLD_ROOM = 'listenere2eroomsecret0123456789a'

let stopRelay: () => Promise<void>
test.beforeAll(async () => {
  stopRelay = await startSignalingRelay()
})
test.afterAll(() => stopRelay())

/**
 * Opens the room as its host and answers every offer, in the page; with no
 * host key, exactly as the released apps do.
 */
async function hostRoom(page: Page, secret: string, hostKey: string | null) {
  await page.goto(`${SIGNALING_RELAY_URL}/signal/${secret}/check`)
  await page.evaluate(
    async ({ secret, hostKey }) => {
      const authorization: Record<string, string> = hostKey
        ? { authorization: `Bearer ${hostKey}` }
        : {}
      const post = (path: string, body: unknown) =>
        fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authorization },
          body: JSON.stringify(body),
        })
      const registered = await post('/signal/register', { secret })
      if (!registered.ok) throw new Error(`register: ${registered.status}`)

      const answerOffer = async (sessionId: string, offer: string) => {
        const pc = new RTCPeerConnection()
        pc.ondatachannel = ({ channel }) => {
          channel.onopen = () =>
            channel.send(
              JSON.stringify({
                type: 'available_languages',
                languages: [{ targetId: 'en-1', code: 'en' }],
              }),
            )
          channel.onmessage = ({ data }) => {
            if (JSON.parse(data).type !== 'select_language') return
            channel.send(
              JSON.stringify({ type: 'text', text: 'Grace and peace' }),
            )
          }
        }
        await pc.setRemoteDescription({ type: 'offer', sdp: offer })
        await pc.setLocalDescription(await pc.createAnswer())
        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') return resolve(null)
          pc.onicegatheringstatechange = () =>
            pc.iceGatheringState === 'complete' && resolve(null)
          setTimeout(resolve, 1500)
        })
        await post(`/signal/${secret}/answer`, {
          sessionId,
          answer: pc.localDescription?.sdp,
        })
      }

      setInterval(async () => {
        const res = await fetch(`/signal/${secret}/offers`, {
          headers: authorization,
        })
        const { offers } = (await res.json()) as {
          offers: Array<{ sessionId: string; offer: string }>
        }
        for (const { sessionId, offer } of offers) {
          await answerOffer(sessionId, offer)
        }
      }, 300)
    },
    { secret, hostKey },
  )
}

for (const [name, room, hostKey] of [
  ['a hosted room', ROOM, HOST_KEY],
  ['a released app’s room', OLD_ROOM, null],
] as const) {
  test(`a listener joins ${name} with the link and hears the host`, async ({
    browser,
  }) => {
    const host = await browser.newPage()
    await hostRoom(host, room, hostKey)

    const listener = await browser.newPage()
    await listener.goto(`${SIGNALING_RELAY_URL}/listen/${room}`)
    await listener.getByRole('button', { name: 'Join' }).click()
    await expect(listener.locator('#statusText')).toHaveText('Connected', {
      timeout: 20_000,
    })
    // One language: the page picks it, and the host's text arrives.
    await expect(listener.locator('.transcript-line')).toHaveText(
      'Grace and peace',
    )

    await host.close()
    await listener.close()
  })
}

test('a hosted room’s link alone cannot act as the host', async ({
  browser,
}) => {
  const host = await browser.newPage()
  await hostRoom(host, ROOM, HOST_KEY)

  const listener = await browser.newPage()
  await listener.goto(`${SIGNALING_RELAY_URL}/listen/${ROOM}`)
  const statuses = await listener.evaluate(async (secret) => {
    const post = (path: string, body: unknown, authorization?: string) =>
      fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify(body),
      })
    const sessionId = crypto.randomUUID()
    return {
      unregister: (await post('/signal/unregister', { secret })).status,
      offers: (await fetch(`/signal/${secret}/offers`)).status,
      answer: (
        await post(`/signal/${secret}/answer`, { sessionId, answer: 'v=0' })
      ).status,
      takeOver: (
        await post(
          '/signal/register',
          { secret },
          'Bearer someone-elses-key-0123456789abcdefghij',
        )
      ).status,
      stillOpen: (await (await fetch(`/signal/${secret}/check`)).json()).active,
    }
  }, ROOM)
  expect(statuses).toEqual({
    unregister: 401,
    offers: 401,
    answer: 401,
    takeOver: 401,
    stillOpen: true,
  })

  await host.close()
  await listener.close()
})
