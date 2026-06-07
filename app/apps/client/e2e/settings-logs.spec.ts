import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Verifies the in-app Logs feature end to end:
 *  - GET /api/logs/content is gated by `logs.view`,
 *  - POST /api/logs/clear is gated (independently) by `logs.clear`,
 *  - the two permissions can be granted independently to a user,
 *  - the activity ingestion endpoint accepts client events,
 *  - and the super admin sees the Logs settings section in the UI.
 *
 * The default `request` fixture carries the super-admin session (auth.setup.ts).
 * For the limited-user checks we spin up clean contexts with their own session.
 */

const PASSWORD = 'e2e-secret-123'

test.describe('Settings · Logs', () => {
  // One test truncates the shared log dir; run serially so the auth-log
  // assertion isn't wiped by a concurrent clear.
  test.describe.configure({ mode: 'serial' })

  test('super admin can read log content', async ({ request }) => {
    const res = await request.get('/api/logs/content')
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    expect(typeof data.logsDir).toBe('string')
    expect(typeof data.serverTail).toBe('string')
    expect(typeof data.tauriTail).toBe('string')
  })

  test('super admin can clear logs', async ({ request }) => {
    const res = await request.post('/api/logs/clear')
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()
    expect(typeof data.cleared).toBe('number')
  })

  test('a user WITHOUT logs perms is denied content + clear', async ({
    request,
    playwright,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string
    const create = await request.post('/api/users', {
      data: {
        name: `E2E NoLogs ${Date.now()}`,
        permissions: ['songs.view'],
        password: PASSWORD,
      },
    })
    expect([200, 201]).toContain(create.status())
    const userId = (await create.json()).data.user.id as number

    const guest: APIRequestContext = await playwright.request.newContext({
      baseURL,
    })
    try {
      const login = await guest.post('/api/auth/login', {
        data: { userId, password: PASSWORD },
      })
      expect(login.ok()).toBeTruthy()

      expect((await guest.get('/api/logs/content')).status()).toBe(403)
      expect((await guest.post('/api/logs/clear')).status()).toBe(403)
    } finally {
      await guest.dispose()
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('logs.view grants read but NOT clear (independent perms)', async ({
    request,
    playwright,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string
    const create = await request.post('/api/users', {
      data: {
        name: `E2E LogsView ${Date.now()}`,
        permissions: ['logs.view'],
        password: PASSWORD,
      },
    })
    expect([200, 201]).toContain(create.status())
    const userId = (await create.json()).data.user.id as number

    const guest: APIRequestContext = await playwright.request.newContext({
      baseURL,
    })
    try {
      const login = await guest.post('/api/auth/login', {
        data: { userId, password: PASSWORD },
      })
      expect(login.ok()).toBeTruthy()

      // /api/auth/me reflects the single granted permission.
      const me = await (await guest.get('/api/auth/me')).json()
      expect(me.data.permissions).toContain('logs.view')
      expect(me.data.permissions).not.toContain('logs.clear')

      // Can read logs…
      expect((await guest.get('/api/logs/content')).ok()).toBeTruthy()
      // …but cannot clear them.
      expect((await guest.post('/api/logs/clear')).status()).toBe(403)
    } finally {
      await guest.dispose()
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('client activity ingestion accepts events (public)', async ({
    playwright,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string
    // Pre-auth on purpose — activity (e.g. the login screen) happens before a
    // session exists, so a no-cookie context must be accepted.
    const guest = await playwright.request.newContext({ baseURL })
    try {
      const res = await guest.post('/api/client-activity', {
        data: {
          events: [
            { action: 'navigate', source: 'e2e', context: { path: '/songs' } },
            { action: 'login', source: 'e2e' },
          ],
        },
      })
      expect(res.ok()).toBeTruthy()
      const { data } = await res.json()
      expect(data.received).toBe(2)
    } finally {
      await guest.dispose()
    }
  })

  test('auth events are written to the log', async ({
    request,
    playwright,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL as string
    const name = `E2E AuthLog ${Date.now()}`
    const create = await request.post('/api/users', {
      data: { name, permissions: ['songs.view'], password: PASSWORD },
    })
    const userId = (await create.json()).data.user.id as number

    const guest = await playwright.request.newContext({ baseURL })
    try {
      // A login writes an [auth] "Login success" line to the server log.
      const login = await guest.post('/api/auth/login', {
        data: { userId, password: PASSWORD },
      })
      expect(login.ok()).toBeTruthy()

      // The super admin can read the log content and should see the auth trail.
      // Widen the tail so a busy parallel run doesn't push the line out.
      const { data } = await (
        await request.get('/api/logs/content?maxBytes=1048576&days=1')
      ).json()
      expect(data.serverTail).toContain('[auth]')
      expect(data.serverTail).toContain('Login success')
    } finally {
      await guest.dispose()
      await request.delete(`/api/users/${userId}`)
    }
  })

  test('super admin sees the Logs settings section', async ({ page }) => {
    await page.goto('/settings/logs')
    await page.waitForLoadState('networkidle')

    // Section heading (settings namespace: sections.logs.title) — the section
    // card renders it as the <h2>.
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: /application logs|jurnale aplica/i,
      }),
    ).toBeVisible({ timeout: 10000 })

    // The viewer's server-logs block is present.
    await expect(
      page.getByText(/server logs|jurnale server/i).first(),
    ).toBeVisible()

    // Level filter chips and the search box are present.
    await expect(
      page.getByRole('button', { name: /errors|erori/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /warnings|avertismente/i }),
    ).toBeVisible()
    await expect(
      page.getByPlaceholder(/search logs|caută în jurnale/i),
    ).toBeVisible()

    // Toggling a level off updates its pressed state (filter is interactive).
    const errorsChip = page.getByRole('button', { name: /errors|erori/i })
    await expect(errorsChip).toHaveAttribute('aria-pressed', 'true')
    await errorsChip.click()
    await expect(errorsChip).toHaveAttribute('aria-pressed', 'false')
  })
})
