import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Verifies the users/permissions feature end to end:
 *  - the login screen's public user list,
 *  - password-gated login,
 *  - and that a limited user is actually restricted by the SERVER (not just
 *    the UI) — the whole point of moving enforcement off "localhost = admin".
 *
 * The default `request` fixture carries the super-admin session (see
 * auth.setup.ts). For the limited-user checks we spin up a clean context with
 * no cookie so we exercise a real, separate session.
 */

const PASSWORD = 'e2e-secret-123'

test.describe('Users & permissions', () => {
  test('login screen lists a super admin (public endpoint)', async ({
    request,
  }) => {
    const res = await request.get('/api/auth/local-users')
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.some((u: { isSuperAdmin: boolean }) => u.isSuperAdmin)).toBe(
      true,
    )
  })

  test('a password-protected limited user is restricted server-side', async ({
    request,
    playwright,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string

    // Create a limited user (songs.view only) with a password, as super admin.
    const createRes = await request.post('/api/users', {
      data: {
        name: `E2E Limited ${Date.now()}`,
        permissions: ['songs.view'],
        password: PASSWORD,
      },
    })
    expect([200, 201]).toContain(createRes.status())
    const userId = (await createRes.json()).data.user.id as number

    // A fresh session with no cookie — simulates a separate operator.
    const guest: APIRequestContext = await playwright.request.newContext({
      baseURL,
    })

    try {
      // Wrong password is rejected.
      const wrong = await guest.post('/api/auth/login', {
        data: { userId, password: 'nope' },
      })
      expect(wrong.status()).toBe(401)

      // Correct password signs in and returns the limited permission set.
      const ok = await guest.post('/api/auth/login', {
        data: { userId, password: PASSWORD },
      })
      expect(ok.ok()).toBeTruthy()
      const loggedIn = (await ok.json()).data
      expect(loggedIn.isApp).toBe(false)
      expect(loggedIn.permissions).toContain('songs.view')
      expect(loggedIn.permissions).not.toContain('users.view')

      // /api/auth/me reflects the same limited session.
      const me = await guest.get('/api/auth/me')
      const meData = (await me.json()).data
      expect(meData.isApp).toBe(false)
      expect(meData.permissions).toEqual(['songs.view'])

      // The server forbids user management for a non-admin session.
      const forbidden = await guest.get('/api/users')
      expect(forbidden.status()).toBe(403)

      // But the sidebar configuration is readable without settings.view, so
      // limited users see the same hidden/shown nav items the owner configured
      // (e.g. a hidden Feedback button stays hidden for everyone).
      const sidebarCfg = await guest.get(
        '/api/settings/app_settings/sidebar_configuration',
      )
      expect(sidebarCfg.status()).toBe(200)

      // Other settings still require settings.view → forbidden.
      const otherSetting = await guest.get(
        '/api/settings/app_settings/appearance',
      )
      expect(otherSetting.status()).toBe(403)
    } finally {
      await guest.dispose()
      // Clean up the test user (as super admin).
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('a bible.view user can read the translation selection so the Bible page works', async ({
    request,
    playwright,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string

    const createRes = await request.post('/api/users', {
      data: { name: `E2E Bible ${Date.now()}`, permissions: ['bible.view'] },
    })
    expect([200, 201]).toContain(createRes.status())
    const userId = (await createRes.json()).data.user.id as number

    const guest = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    })

    try {
      const ok = await guest.post('/api/auth/login', { data: { userId } })
      expect(ok.ok()).toBeTruthy()

      // Selecting/reading the Bible translation belongs to the Bible feature,
      // so a bible.view user can read it (without it the page can't render).
      expect(
        (
          await guest.get(
            '/api/settings/app_settings/selected_bible_translations',
          )
        ).status(),
      ).toBe(200)
      // ...and they can pick a translation.
      expect(
        (
          await guest.post('/api/settings/app_settings', {
            data: {
              key: 'selected_bible_translations',
              value: JSON.stringify({ translationIds: [1] }),
            },
          })
        ).status(),
      ).toBe(200)
      // But general settings remain gated by settings.view/edit.
      expect(
        (await guest.get('/api/settings/app_settings/appearance')).status(),
      ).toBe(403)
    } finally {
      await guest.dispose()
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('projector windows (cookie-less localhost) can read display state but not administer', async ({
    playwright,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string
    // No cookie — simulates a projector/screen webview, which doesn't carry
    // the operator's session. Force an empty storage state so it does NOT
    // inherit the shared super-admin session from the project config.
    const projector = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    })

    try {
      // Read-only display endpoints must work so projection renders.
      expect((await projector.get('/api/presentation/state')).status()).toBe(
        200,
      )
      expect((await projector.get('/api/screens')).status()).toBe(200)
      expect(
        (await projector.get('/api/presentation/highlights')).status(),
      ).toBe(200)

      // But administration is still blocked without a real session.
      expect((await projector.get('/api/users')).status()).toBe(403)
    } finally {
      await projector.dispose()
    }
  })

  test('the account page shows the profile and a log out action', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('church-hub-user-selected', '1')
      } catch {
        /* ignore */
      }
    })
    await page.goto('/account')
    await page.waitForLoadState('networkidle')

    // Profile header for the super admin, full-access note, and log out button.
    await expect(
      page.getByRole('heading', { name: /Super Admin/ }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('button', { name: /log out|deconectare/i }),
    ).toBeVisible()
  })

  test('switching account is done by logging out then back in', async ({
    page,
    request,
  }) => {
    const create = await request.post('/api/users', {
      data: {
        name: `E2E Switch ${Date.now()}`,
        permissions: ['songs.view'],
        password: PASSWORD,
      },
    })
    const userId = (await create.json()).data.user.id as number

    try {
      // Start in the app as super admin (bypass launch picker), open account.
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('church-hub-user-selected', '1')
        } catch {
          /* ignore */
        }
      })
      await page.goto('/account')
      await page.waitForLoadState('networkidle')

      // Log out → returns to the account picker (no session).
      await page.getByRole('button', { name: /log out|deconectare/i }).click()
      await page
        .getByRole('button', { name: /E2E Switch/ })
        .waitFor({ timeout: 10000 })

      // Sign in as the other account.
      await page.getByRole('button', { name: /E2E Switch/ }).click()
      await page.locator('#login-password').fill(PASSWORD)
      await page
        .getByRole('button', { name: /sign in|autentificare/i })
        .click()

      await page.waitForTimeout(3500)

      const me = await page.evaluate(() =>
        fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.json()),
      )
      const usersNav = await page
        .getByRole('link', { name: /^Users$|Utilizatori/ })
        .count()

      expect(me.data?.isApp).toBe(false)
      expect(me.data?.permissions).toEqual(['songs.view'])
      expect(usersNav).toBe(0)
    } finally {
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('opening the app with multiple accounts shows the picker', async ({
    page,
    request,
  }) => {
    const create = await request.post('/api/users', {
      data: { name: `E2E Picker ${Date.now()}`, permissions: ['songs.view'] },
    })
    const userId = (await create.json()).data.user.id as number

    try {
      // Fresh launch (no prior in-window selection): even though a session
      // cookie exists (storageState), the picker must appear so the operator
      // chooses an account.
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Both accounts are offered to choose from.
      await expect(
        page.getByRole('button', { name: /E2E Picker/ }),
      ).toBeVisible({ timeout: 10000 })
      await expect(
        page.getByRole('button', { name: /Super Admin/ }),
      ).toBeVisible()
    } finally {
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('a settings.view-only user sees only Appearance and About', async ({
    browser,
    request,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string
    const create = await request.post('/api/users', {
      data: { name: `E2E Viewer ${Date.now()}`, permissions: ['settings.view'] },
    })
    const userId = (await create.json()).data.user.id as number

    // Fresh context as the view-only user (no super-admin storageState).
    const ctx = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    })
    await ctx.addInitScript(() => {
      try {
        sessionStorage.setItem('church-hub-user-selected', '1')
      } catch {
        /* ignore */
      }
    })
    const page = await ctx.newPage()

    try {
      // Sign in as the view-only user (passwordless, allowed from localhost).
      const ok = await page.request.post('/api/auth/login', {
        data: { userId },
      })
      expect(ok.ok()).toBeTruthy()

      await page.goto('/settings')
      await page.waitForLoadState('networkidle')

      // Appearance is visible…
      await expect(
        page.getByRole('heading', { name: /appearance|aspect/i }),
      ).toBeVisible({ timeout: 10000 })
      // …but edit-only sections (Developer tools, Sidebar config, MIDI) are not.
      await expect(
        page.getByRole('heading', { name: /developer|dezvoltator/i }),
      ).toHaveCount(0)
      await expect(
        page.getByText(/sidebar|bară laterală/i),
      ).toHaveCount(0)
    } finally {
      await ctx.close()
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('settings.edit_appearance lets a user change theme/language only', async ({
    request,
    playwright,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string
    const create = await request.post('/api/users', {
      data: {
        name: `E2E Appearance ${Date.now()}`,
        permissions: ['settings.view', 'settings.edit_appearance'],
      },
    })
    const userId = (await create.json()).data.user.id as number

    const guest = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    })

    try {
      expect(
        (await guest.post('/api/auth/login', { data: { userId } })).ok(),
      ).toBeTruthy()

      // Can change theme and language…
      expect(
        (
          await guest.post('/api/settings/app_settings', {
            data: { key: 'theme', value: 'dark' },
          })
        ).status(),
      ).toBe(200)
      expect(
        (
          await guest.post('/api/settings/app_settings', {
            data: { key: 'language', value: 'ro' },
          })
        ).status(),
      ).toBe(200)
      // …but not other settings (those still require settings.edit).
      expect(
        (
          await guest.post('/api/settings/app_settings', {
            data: { key: 'sidebar_configuration', value: '{}' },
          })
        ).status(),
      ).toBe(403)
    } finally {
      await guest.dispose()
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('the users list is searchable and shows the super admin first', async ({
    page,
    request,
  }) => {
    const stamp = Date.now()
    const a = await request.post('/api/users', {
      data: { name: `ZetaActive ${stamp}`, permissions: ['songs.view'] },
    })
    const aId = (await a.json()).data.user.id as number
    const b = await request.post('/api/users', {
      data: { name: `AlphaInactive ${stamp}`, permissions: ['songs.view'] },
    })
    const bId = (await b.json()).data.user.id as number
    await request.put(`/api/users/${bId}`, { data: { isActive: false } })

    try {
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('church-hub-user-selected', '1')
        } catch {
          /* ignore */
        }
      })
      await page.goto('/users')
      await page.waitForLoadState('networkidle')

      // The super admin is always the first card.
      const names = await page.locator('h3.text-base').allTextContents()
      expect(names[0]).toMatch(/Super Admin/)

      // Search filters by name.
      const search = page.getByPlaceholder(/search users|caută/i)
      await search.fill(`ZetaActive ${stamp}`)
      await expect(
        page.getByRole('heading', { name: `ZetaActive ${stamp}` }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: `AlphaInactive ${stamp}` }),
      ).toHaveCount(0)
    } finally {
      await request.delete(`/api/users/${aId}`)
      await request.delete(`/api/users/${bId}`)
    }
  })

  test('the super admin account cannot be deleted or deactivated', async ({
    request,
  }) => {
    const { data: users } = await (await request.get('/api/users')).json()
    const superAdmin = users.find(
      (u: { isSuperAdmin: boolean }) => u.isSuperAdmin,
    )
    expect(superAdmin).toBeTruthy()

    await request.delete(`/api/users/${superAdmin.id}`)
    await request.put(`/api/users/${superAdmin.id}`, {
      data: { isActive: false },
    })

    // Still present and still active afterwards.
    const after = await (await request.get('/api/users')).json()
    const stillThere = after.data.find(
      (u: { id: number }) => u.id === superAdmin.id,
    )
    expect(stillThere).toBeTruthy()
    expect(stillThere.isActive).toBe(true)
  })
})
