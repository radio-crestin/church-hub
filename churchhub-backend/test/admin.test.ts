import { afterEach, beforeEach, expect, test } from 'bun:test'
import app from '../src/index'
import { BackupHarness, backupEnv } from './support/backupHarness'

/**
 * The internal admin panel: only allowlisted Google accounts, only on its
 * own listener (the public app has no /admin routes), CSRF on every change,
 * every call in the append-only audit log, and quota overrides that the
 * upload checks obey. Run with `bun test` from churchhub-backend/.
 */
const ADMIN = { sub: 'google-sub-admin', email: 'admin@example.com' }
const USER = { sub: 'google-sub-user', email: 'user@example.com' }

let harness: BackupHarness
beforeEach(() => {
  harness = new BackupHarness(
    backupEnv({ ADMIN_EMAILS: ADMIN.email, BACKUP_QUOTA_BYTES: '1000' })
  )
  harness.install()
})
afterEach(() => harness.restore())

const ACCOUNT = 'a'.repeat(64)
const ADMIN_ROUTES: [string, string, unknown?][] = [
  ['GET', '/tombstones'],
  ['DELETE', `/tombstones/${ACCOUNT}`, {}],
  ['GET', '/session'],
  ['POST', '/sign-out', {}],
  ['GET', '/accounts'],
  ['GET', `/accounts/${ACCOUNT}`],
  ['PUT', `/accounts/${ACCOUNT}/quota`, { quotaBytes: 1 }],
  ['PUT', `/accounts/${ACCOUNT}/suspended`, { suspended: true }],
  ['POST', `/accounts/${ACCOUNT}/reconcile`, {}],
  ['DELETE', `/accounts/${ACCOUNT}`, { confirm: ACCOUNT }],
  ['GET', '/audit'],
]

async function signedInAdmin() {
  const { cookie } = await harness.adminSignIn(ADMIN)
  const session = (await (await harness.adminApi('/session', { cookie })).json()) as {
    csrfToken: string
  }
  return { cookie, csrf: session.csrfToken }
}

/** The account id a signed-in user's backups live under. */
async function userAccount() {
  const user = await harness.signIn(USER)
  const listed = (await (await harness.adminApi('/accounts', await signedInAdmin())).json()) as {
    accounts: { id: string; email: string }[]
  }
  return { user, id: listed.accounts.find((a) => a.email === USER.email)?.id as string }
}

test('unauthenticated and non-admin callers get 403 on every admin route', async () => {
  const refused = await harness.adminSignIn(USER)
  expect(refused.status).toBe(403)
  expect(refused.cookie).toBeNull()
  // A user's own backup token is no admin credential either.
  const { accessToken } = await harness.signIn(USER)
  for (const cookie of [null, '__Host-chadmin=forged', `__Host-chadmin=${accessToken}`]) {
    for (const [method, path, body] of ADMIN_ROUTES) {
      const response = await harness.adminApi(path, { method, body, cookie, csrf: 'x' })
      expect(`${method} ${path} ${response.status}`).toBe(`${method} ${path} 403`)
    }
  }
})

test('the admin listener counts sign-ins by result, without emails', async () => {
  const read = async () => {
    const text = await (await harness.admin.request('https://admin.test/metrics', {}, harness.env)).text()
    const count = (result: string) =>
      Number(text.match(new RegExp(`churchhub_admin_signin_total\\{result="${result}"\\} (\\d+)`))?.[1])
    return { text, success: count('success'), failure: count('failure') }
  }
  const before = await read()
  await harness.adminSignIn(ADMIN)
  await harness.adminSignIn(USER)
  await harness.adminSignIn(USER)
  const after = await read()
  expect(after.success - before.success).toBe(1)
  expect(after.failure - before.failure).toBe(2)
  expect(after.text).toContain('# TYPE churchhub_admin_signin_total counter')
  expect(after.text).not.toContain('@')
})

test('the public listener has no admin routes', async () => {
  for (const path of ['/admin', '/admin/sign-in', '/admin/api/accounts', '/admin/api/session', '/metrics']) {
    const response = await app.request(`https://backend.test${path}`, {}, harness.env)
    expect(`${path} ${response.status}`).toBe(`${path} 404`)
  }
})

test('the admin session cookie is HttpOnly, Secure, SameSite=Strict and short-lived', async () => {
  const start = await harness.admin.request('https://admin.test/admin/sign-in', {}, harness.env)
  expect(start.headers.getSetCookie().join()).toMatch(/__Host-chadmin-flow=.*HttpOnly.*Secure.*SameSite=Lax/i)
  const { setCookie } = await harness.adminSignIn(ADMIN)
  const session = setCookie.split('\n').find((line) => line.startsWith('__Host-chadmin='))
  expect(session).toMatch(/Max-Age=3600/)
  expect(session).toMatch(/Path=\//)
  expect(session).toMatch(/HttpOnly/)
  expect(session).toMatch(/Secure/)
  expect(session).toMatch(/SameSite=Strict/)
  const page = await harness.admin.request('https://admin.test/admin', {}, harness.env)
  expect(page.headers.get('Content-Security-Policy')).toContain("script-src 'nonce-")
})

test('every change needs the CSRF token and a same-origin request', async () => {
  const { id } = await userAccount()
  const { cookie, csrf } = await signedInAdmin()
  const change = (extra: { csrf?: string; headers?: Record<string, string> }) =>
    harness.adminApi(`/accounts/${id}/suspended`, { method: 'PUT', body: { suspended: true }, cookie, ...extra })
  expect((await change({})).status).toBe(403)
  expect((await change({ csrf: 'wrong' })).status).toBe(403)
  expect((await change({ csrf, headers: { Origin: 'https://evil.test' } })).status).toBe(403)
  expect((await change({ csrf, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403)
  expect((await change({ csrf, headers: { Origin: 'https://admin.test', 'Sec-Fetch-Site': 'same-origin' } })).status).toBe(200)
})

test('a quota override changes what the account may upload', async () => {
  const { user, id } = await userAccount()
  const admin = await signedInAdmin()
  const start = (userBytes: number) => harness.start(user.accessToken, userBytes)
  expect((await start(850)).status).toBe(201)
  expect((await start(150)).status).toBe(413)

  const raised = await harness.adminApi(`/accounts/${id}/quota`, {
    method: 'PUT',
    body: { quotaBytes: 5000 },
    ...admin,
  })
  expect(((await raised.json()) as { quotaBytes: number }).quotaBytes).toBe(5000)
  expect((await start(150)).status).toBe(201)
  const usage = (await (await harness.request('/backup/usage', {}, user.accessToken)).json()) as {
    quotaBytes: number
  }
  expect(usage.quotaBytes).toBe(5000)

  const tooHigh = await harness.adminApi(`/accounts/${id}/quota`, {
    method: 'PUT',
    body: { quotaBytes: 51 * 1024 ** 3 },
    ...admin,
  })
  expect(tooHigh.status).toBe(400)
})

test('a paused account can’t start uploads', async () => {
  const { user, id } = await userAccount()
  await harness.adminApi(`/accounts/${id}/suspended`, { method: 'PUT', body: { suspended: true }, ...(await signedInAdmin()) })
  const refused = await harness.start(user.accessToken, 10)
  expect(refused.status).toBe(403)
  expect(((await refused.json()) as { code: string }).code).toBe('suspended')
})

test('every admin call is in the audit log, changes with before and after', async () => {
  const { user, id } = await userAccount()
  await harness.upload(user.accessToken, new Uint8Array(100))
  const admin = await signedInAdmin()
  await harness.adminApi(`/accounts/${id}/quota`, { method: 'PUT', body: { quotaBytes: 4000 }, ...admin })
  await harness.adminApi(`/accounts/${id}/suspended`, { method: 'PUT', body: { suspended: true }, ...admin })
  await harness.adminApi(`/accounts/${id}/reconcile`, { method: 'POST', body: {}, ...admin })
  const unconfirmed = await harness.adminApi(`/accounts/${id}`, { method: 'DELETE', body: { confirm: 'nope' }, ...admin })
  expect(unconfirmed.status).toBe(400)
  const deleted = await harness.adminApi(`/accounts/${id}`, { method: 'DELETE', body: { confirm: USER.email }, ...admin })
  expect(await deleted.json()).toEqual({ deletedBackups: 1 })
  await harness.adminApi('/accounts', { cookie: null })

  const { entries } = (await (await harness.adminApi('/audit', admin)).json()) as {
    entries: { admin: string | null; action: string; status: number; before?: unknown; after?: unknown; target: string | null }[]
  }
  const find = (action: string) => entries.find((e) => e.action === action)
  expect(find(`PUT /admin/api/accounts/${id}/quota`)).toMatchObject({
    admin: ADMIN.email,
    target: id,
    status: 200,
    before: { quotaBytes: null },
    after: { quotaBytes: 4000 },
  })
  expect(find(`PUT /admin/api/accounts/${id}/suspended`)).toMatchObject({ before: { suspended: false }, after: { suspended: true } })
  expect(find(`POST /admin/api/accounts/${id}/reconcile`)).toMatchObject({ after: { usedBytes: 150 } })
  expect(entries.filter((e) => e.action === `DELETE /admin/api/accounts/${id}`).map((e) => e.status).sort()).toEqual([200, 400])
  expect(find('sign_in')).toMatchObject({ admin: ADMIN.email, status: 200 })
  expect(entries.some((e) => e.action === 'GET /admin/api/accounts' && e.admin === null && e.status === 403)).toBe(true)
  // The deleted account is gone from the list and its backups from the bucket.
  const listed = (await (await harness.adminApi('/accounts', admin)).json()) as { accounts: unknown[] }
  expect(listed.accounts).toEqual([])
  expect(harness.s3.keys().filter((key) => key.endsWith('.chb'))).toEqual([])
})

test('accounts are searchable by email and paged', async () => {
  await harness.signIn(USER)
  await harness.signIn({ sub: 'google-sub-other', email: 'other@church.test' })
  const admin = await signedInAdmin()
  const all = (await (await harness.adminApi('/accounts', admin)).json()) as { total: number }
  expect(all.total).toBe(2)
  const found = (await (await harness.adminApi('/accounts?query=church', admin)).json()) as {
    accounts: { email: string }[]
  }
  expect(found.accounts.map((a) => a.email)).toEqual(['other@church.test'])
})

test('an admin purges a deleted account’s tombstone early, audited', async () => {
  const { user, id } = await userAccount()
  await harness.request('/backup/account', { method: 'DELETE' }, user.accessToken)
  const admin = await signedInAdmin()
  const listed = (await (await harness.adminApi('/tombstones', admin)).json()) as {
    tombstones: { accountId: string; purgeAt: number; deletedAt: number }[]
  }
  expect(listed.tombstones.map((t) => t.accountId)).toEqual([id])
  expect(listed.tombstones[0].purgeAt - listed.tombstones[0].deletedAt).toBe(90 * 24 * 60 * 60 * 1000)

  const purged = await harness.adminApi(`/tombstones/${id}`, { method: 'DELETE', body: {}, ...admin })
  expect(purged.status).toBe(200)
  expect(harness.s3.keys().filter((key) => key.startsWith('tombstones/'))).toEqual([])
  const { entries } = (await (await harness.adminApi('/audit', admin)).json()) as {
    entries: { action: string; admin: string; before?: unknown; after?: unknown }[]
  }
  expect(entries.find((e) => e.action === `DELETE /admin/api/tombstones/${id}`)).toMatchObject({
    admin: ADMIN.email,
    before: { suspended: false },
    after: { purged: true },
  })
})
