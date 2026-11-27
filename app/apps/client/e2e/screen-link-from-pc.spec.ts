import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { lanBaseUrl } from './helpers/lan-address'
import { PUBLIC_APP_URL } from '../playwright.config'

/**
 * Screen links from the church PC (T-214): by default a link opens the PC
 * directly on the church network, where the device signs in with the link
 * alone; under Advanced it can go over the internet instead, through the
 * public web app and WebRTC to the PC's remote access room. Revoking it ends
 * that device's session.
 */

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function setRemoteAccess(request: APIRequestContext, enabled: boolean) {
  const res = await request.put('/api/remote-access', { data: { enabled } })
  expect(res.ok()).toBe(true)
  return (await res.json()).data as { secret: string; relay: string }
}

async function firstScreenId(request: APIRequestContext): Promise<number> {
  const screens = (await (await request.get('/api/screens')).json()).data as {
    id: number
  }[]
  return screens[0].id
}

async function openScreenLink(page: Page, screenId: number) {
  await setAppLanguage(page, 'en')
  await page.goto(`/settings/screens?screen=${screenId}`)
  await page.getByRole('button', { name: 'More screen actions' }).click()
  await page.getByTestId('screen-show-elsewhere').click()
  return page.getByTestId('screen-link-url')
}

test.describe
  .serial('A screen link from the PC', () => {
    test('opens the PC on the network by default; Advanced goes over the internet', async ({
      page,
      request,
    }) => {
      const { secret, relay } = await setRemoteAccess(request, true)
      try {
        const screenId = await firstScreenId(request)
        const url = await openScreenLink(page, screenId)
        await expect(url).toHaveValue(
          new RegExp(`^http://[\\d.]+:\\d+/screen/${screenId}#g=scr_`),
        )
        const token = new URLSearchParams(
          (await url.inputValue()).split('#')[1],
        ).get('g')

        await page.getByRole('button', { name: 'Advanced' }).click()
        await page.getByTestId('screen-link-way-internet').check()
        // The public web app's address, never this computer's.
        await expect(url).toHaveValue(
          new RegExp(`^${escape(PUBLIC_APP_URL)}/screen/${screenId}#`),
        )
        const fragment = new URLSearchParams(
          (await url.inputValue()).split('#')[1],
        )
        expect(fragment.get('h')).toBe(secret)
        expect(fragment.get('r')).toBe(relay)
        expect(fragment.get('g')).toBe(token)
      } finally {
        await setRemoteAccess(request, false)
      }
    })

    test('with remote access off, a device on the network opens it directly; revoking ends it', async ({
      page,
      request,
      browser,
    }) => {
      const screenId = await firstScreenId(request)
      const url = await openScreenLink(page, screenId)
      await expect(url).toHaveValue(
        new RegExp(`^http://[\\d.]+:\\d+/screen/${screenId}#g=scr_`),
      )
      // The internet way needs remote access: it says so, and can't be chosen.
      await page.getByRole('button', { name: 'Advanced' }).click()
      await expect(page.getByTestId('screen-link-way-internet')).toBeDisabled()
      await expect(
        page.getByTestId('screen-link-way-internet-hint'),
      ).toContainText('Remote access is off')
      const token = new URLSearchParams(
        (await url.inputValue()).split('#')[1],
      ).get('g')

      // A TV on the church network, signed in by nothing but the link.
      const tv = await browser.newContext()
      const tvPage = await tv.newPage()
      await tvPage.goto(`${lanBaseUrl()}/screen/${screenId}#g=${token}`)
      await expect(tvPage.locator('#loading-screen')).toBeHidden({
        timeout: 30_000,
      })
      const status = (path: string) =>
        tvPage.evaluate(
          async (path) =>
            (await fetch(path, { credentials: 'include' })).status,
          path,
        )
      expect(await status('/api/screen-links/session')).toBe(200)
      expect(await status('/api/users')).toBe(403)

      const lyrics = `On the network ${Date.now()}`
      const song = await request.post('/api/songs', {
        data: {
          title: `E2E Direct Screen Link ${Date.now()}`,
          slides: [{ content: `<p>${lyrics}</p>`, sortOrder: 0 }],
        },
      })
      const songId = (await song.json()).data.id
      expect(
        (
          await request.post('/api/presentation/temporary-song', {
            data: { songId, slideIndex: 0 },
          })
        ).ok(),
      ).toBe(true)
      await expect(
        tvPage.getByText(lyrics, { exact: true }).last(),
      ).toBeVisible({ timeout: 20_000 })

      await page.getByRole('button', { name: 'Revoke link' }).click()
      await expect(page.getByTestId('screen-link-modal')).toHaveCount(0)
      expect(await status('/api/screen-links/session')).toBe(401)
      await tvPage.reload()
      await expect(
        tvPage.getByText('This screen link no longer works.'),
      ).toBeVisible({ timeout: 30_000 })
      await request.post('/api/presentation/clear-temporary')
      await tv.close()

      // The links' store is the server's own: the settings API neither
      // lists it nor hands it out.
      expect(
        (await request.get('/api/settings/app_settings/screen_links')).status(),
      ).toBe(403)
      const settings = (
        await (await request.get('/api/settings/app_settings')).json()
      ).data as { key: string }[]
      expect(settings.map(({ key }) => key)).not.toContain('screen_links')
    })
  })
