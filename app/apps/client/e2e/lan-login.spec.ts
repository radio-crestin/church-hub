import { request as httpRequest } from 'node:http'
import { expect, type Page, test } from '@playwright/test'

import { lanBaseUrl, lanLookup } from './helpers/lan-address'

/**
 * Signing in from another device on the church network (T-167). A browser
 * that loads Church Hub by the PC's LAN address (not localhost) must be able
 * to sign in and use /present:
 * - an account with a password, by its password;
 * - a passwordless account (the super admin is one on a fresh install), by
 *   the pairing code the desktop app shows on the Church Hub computer; a wrong
 *   code is refused.
 * The `page` fixture (localhost, signed in as the super admin) plays the
 * desktop app.
 */

interface LocalUser {
  id: number
  name: string
  isSuperAdmin: boolean
}

const PASSWORD = 'lan-login-123'

async function openLoginFromLan(page: Page, baseURL: string) {
  await page.goto(`${lanBaseUrl(baseURL)}/present`)
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
}

async function expectSignedInOnPresent(page: Page, name: string) {
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeHidden()
  await expect(page).toHaveURL(/\/present/)
  const me = await page.evaluate(async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    return (await res.json()) as { data: { name: string } | null }
  })
  expect(me.data?.name).toBe(name)
}

test.describe('Login from the LAN', () => {
  test('an account with a password signs in by the PC address', async ({
    browser,
    request,
    baseURL,
  }) => {
    const name = `LAN user ${Date.now()}`
    const created = await request.post('/api/users', {
      data: {
        name,
        permissions: ['songs.view', 'control_room.view'],
        password: PASSWORD,
      },
    })
    expect(created.ok()).toBe(true)
    const userId = (await created.json()).data.user.id as number

    const remote = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await remote.newPage()
    try {
      await openLoginFromLan(page, baseURL as string)
      await page.getByRole('button', { name: new RegExp(name) }).click()
      await page.locator('#login-password').fill(PASSWORD)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expectSignedInOnPresent(page, name)
    } finally {
      await remote.close()
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('the super admin signs in with the code the desktop app shows; a wrong code is refused', async ({
    browser,
    page: desktop,
    request,
    baseURL,
  }) => {
    const users = (
      (await (await request.get('/api/auth/local-users')).json()) as {
        data: LocalUser[]
      }
    ).data
    const superAdmin = users.find((u) => u.isSuperAdmin) as LocalUser

    // The desktop app, signed in on the Church Hub computer.
    await desktop.goto('/')
    await expect(desktop.getByRole('heading', { name: 'Welcome' })).toBeHidden()

    const remote = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await remote.newPage()
    try {
      await openLoginFromLan(page, baseURL as string)
      await page
        .getByRole('button', { name: new RegExp(superAdmin.name) })
        .first()
        .click()
      await expect(page.getByText('Pairing code')).toBeVisible()

      const shown = desktop.getByTestId('login-pairing-code')
      await expect(shown).toHaveText(/^\d{6}$/)
      const code = (await shown.textContent()) as string
      const wrong = `${(Number(code[0]) + 1) % 10}${code.slice(1)}`

      await page.locator('#login-password').fill(wrong)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByRole('alert')).toContainText('Wrong or expired')
      await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()

      await page.locator('#login-password').fill(code)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expectSignedInOnPresent(page, superAdmin.name)
      // Used: the desktop app hides it.
      await expect(shown).toBeHidden()
    } finally {
      await remote.close()
    }
  })

  test('a Host header of localhost does not make a LAN request local', async ({
    request,
    baseURL,
  }) => {
    const users = (
      (await (await request.get('/api/auth/local-users')).json()) as {
        data: LocalUser[]
      }
    ).data
    const superAdmin = users.find((u) => u.isSuperAdmin) as LocalUser

    // Node's http client sends any Host header (browsers and fetch refuse).
    const lan = new URL(lanBaseUrl(baseURL as string))
    const res = await new Promise<{
      status: number
      cookie: unknown
      body: string
    }>((resolve, reject) => {
      const req = httpRequest(
        {
          host: lan.hostname,
          port: lan.port,
          lookup: lanLookup,
          path: '/api/auth/login',
          method: 'POST',
          headers: {
            Host: `localhost:${lan.port}`,
            Origin: 'http://localhost',
            'Content-Type': 'application/json',
          },
        },
        (response) => {
          let body = ''
          response.setEncoding('utf8')
          response.on('data', (chunk) => {
            body += chunk
          })
          response.on('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              cookie: response.headers['set-cookie'],
              body,
            }),
          )
        },
      )
      req.on('error', reject)
      req.end(JSON.stringify({ userId: superAdmin.id }))
    })
    expect(res.status).toBe(401)
    expect(JSON.parse(res.body).error).toBe('pairing_required')
    expect(res.cookie).toBeUndefined()
  })
})
