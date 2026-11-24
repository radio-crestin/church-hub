import { expect, type Page, test } from '@playwright/test'

import { lanBaseUrl } from './helpers/lan-address'

/**
 * Pairing a phone with the computer (CH-050). Settings > Phones on the
 * computer shows a QR code for the account the phone signs in with; a phone
 * on the church Wi-Fi opens it with its camera and is signed in, and the
 * Church Hub app on the phone reads it with "Scan the QR code" and connects
 * at once. The `page` fixture (localhost) plays the computer.
 */

const PHONE = { width: 390, height: 844 }
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'

async function createUser(page: Page, name: string) {
  const created = await page.request.post('/api/users', {
    data: { name, permissions: ['songs.view', 'control_room.view'] },
  })
  expect(created.ok()).toBe(true)
  const { data } = await created.json()
  return { id: data.user.id as number, token: data.token as string }
}

/** The link in the pairing QR code on the computer's Settings > Phones. */
async function pairingLink(page: Page) {
  const qr = page.getByTestId('pairing-qr')
  await expect(qr).toBeVisible()
  return (await qr.getAttribute('data-url')) as string
}

test.describe('Pairing a phone', () => {
  test('Settings > Phones shows the code that signs a phone in', async ({
    page,
    browser,
  }) => {
    const name = `Phone user ${Date.now()}`
    const user = await createUser(page, name)
    try {
      await page.goto('/settings/phones')
      await page.getByTestId('phone-account').click()
      await page
        .getByTestId('phone-account-option')
        .filter({ hasText: name })
        .click()
      const link = await pairingLink(page)
      expect(link).toContain(`/api/auth/user/${encodeURIComponent(user.token)}`)

      // The phone opens the link on the computer's address, as its camera would.
      const phone = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        viewport: PHONE,
      })
      const phonePage = await phone.newPage()
      const path = new URL(link).pathname
      await phonePage.goto(`${lanBaseUrl()}${path}`)
      await phonePage.goto(`${lanBaseUrl()}/present`)
      await expect
        .poll(() =>
          phonePage.evaluate(async () => {
            const res = await fetch('/api/auth/me', { credentials: 'include' })
            return ((await res.json()) as { data: { name: string } | null })
              .data?.name
          }),
        )
        .toBe(name)
      await phone.close()
    } finally {
      await page.request.delete(`/api/users/${user.id}`)
    }
  })

  test('the phone app scans the code and connects at once', async ({
    page,
    browser,
    baseURL,
  }) => {
    const name = `Scanning phone ${Date.now()}`
    const user = await createUser(page, name)
    const link = `${baseURL}/api/auth/user/${encodeURIComponent(user.token)}`
    try {
      const phone = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        viewport: PHONE,
        userAgent: IPHONE_UA,
      })
      const app = await phone.newPage()
      // The Church Hub app on an iPhone: Tauri's bridge, its camera scanner
      // reading the computer's code, and its HTTP client doing real requests.
      await app.addInitScript((scanned) => {
        const pending = new Map<number, string>()
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
            invoke: async (command: string, args?: Record<string, unknown>) => {
              switch (command) {
                case 'plugin:barcode-scanner|check_permissions':
                  return { camera: 'granted' }
                case 'plugin:barcode-scanner|scan':
                  return { content: scanned, format: 'QR_CODE', bounds: {} }
                case 'plugin:http|fetch': {
                  const rid = nextRid++
                  const config = args?.clientConfig as { url: string }
                  pending.set(rid, config.url)
                  return rid
                }
                case 'plugin:http|fetch_send': {
                  const url = pending.get(args?.rid as number) as string
                  const res = await fetch(url)
                  return {
                    status: res.status,
                    statusText: res.statusText,
                    url,
                    headers: [],
                    rid: nextRid++,
                  }
                }
                default:
                  return null
              }
            },
          },
        })
      }, link)

      await app.goto('/')
      await app.getByTestId('scan-pairing-code').click()
      // Saved, the app reloads onto the computer: read across the reload.
      await expect
        .poll(() =>
          app
            .evaluate(() => ({
              server: localStorage.getItem('church-hub-api-url'),
              token: localStorage.getItem('church-hub-user-auth'),
            }))
            .catch(() => null),
        )
        .toEqual({ server: baseURL, token: user.token })
      await phone.close()
    } finally {
      await page.request.delete(`/api/users/${user.id}`)
    }
  })
})
