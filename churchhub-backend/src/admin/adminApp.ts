import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { secureHeaders } from 'hono/secure-headers'
import type { AccountRecord } from '../backup/account/AccountRecord'
import { accountRecordKey } from '../backup/account/accountKeys'
import { readAccount, updateAccount } from '../backup/account/accountStore'
import { deleteAccount } from '../backup/account/deleteAccount'
import { publicBackup } from '../backup/account/publicBackup'
import { reconcileAccount } from '../backup/account/reconcileAccount'
import {
  readTombstone,
  TOMBSTONE_DAYS,
  TOMBSTONES_PREFIX,
  tombstoneKey,
} from '../backup/account/tombstone'
import { readBackupSettings } from '../backup/backupSettings'
import { handleBackupError } from '../backup/handleBackupError'
import { createBackupBucket } from '../backup/storage/createBackupBucket'
import { readJsonBody } from '../sync/readJsonBody'
import { SyncError } from '../sync/SyncError'
import type { Bindings } from '../types'
import { isAllowedAdmin } from './adminAllowlist'
import { countAdminSignIn, renderAdminMetrics } from './adminMetrics'
import { adminPage } from './adminPage'
import {
  ADMIN_SESSION_TTL_SECONDS,
  type AdminSession,
  FLOW_COOKIE,
  SESSION_COOKIE,
  createAdminSession,
  csrfMatches,
  readAdminSession,
} from './adminSession'
import { finishAdminSignIn, startAdminSignIn } from './adminSignIn'
import { type AuditEntry, appendAudit, readAudit } from './auditLog'
import { describeAccount } from './describeAccount'
import { listAdminAccounts } from './listAdminAccounts'

/** The highest quota an admin may give one account. */
export const MAX_ADMIN_QUOTA_BYTES = 50 * 1024 * 1024 * 1024
const ACCOUNT_ID = /^[0-9a-f]{64}$/
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

type AdminEnv = {
  Bindings: Bindings
  Variables: { admin: AdminSession; audit: Partial<AuditEntry> }
}
type AdminContext = Context<AdminEnv>

const storage = (c: { env: Bindings }) => {
  const settings = readBackupSettings(c.env)
  return { settings, bucket: createBackupBucket(settings.bucket) }
}

/** A changing call from this panel's own page: same host, same origin. */
function isSameOrigin(c: AdminContext): boolean {
  const origin = c.req.header('Origin')
  const site = c.req.header('Sec-Fetch-Site')
  if (site && site !== 'same-origin' && site !== 'none') return false
  if (!origin) return true
  try {
    return new URL(origin).host === c.req.header('Host')
  } catch {
    return false
  }
}

/**
 * The internal admin panel of Church Hub Cloud backup. Mounted only on the
 * Node runtime's admin listener (ADMIN_PORT), never on the public one nor
 * on the Worker. Admins sign in with Google and must be on the allowlist
 * (ADMIN_GOOGLE_SUBS / ADMIN_EMAILS); sessions last an hour in an
 * HttpOnly, Secure, SameSite=Strict cookie; every changing call needs the
 * session's CSRF token and a same-origin request; every API call is
 * written to the append-only audit log.
 */
const adminApp = new Hono<AdminEnv>()

adminApp.onError(handleBackupError)
adminApp.use(
  '*',
  secureHeaders({
    xFrameOptions: 'DENY',
    referrerPolicy: 'no-referrer',
    strictTransportSecurity: false,
  })
)
adminApp.use(
  '/admin/*',
  bodyLimit({
    maxSize: 16 * 1024,
    onError: (c) => c.json({ error: 'Request is too large', code: 'too_large' }, 413),
  })
)
adminApp.use('/admin/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
})

/**
 * GET /metrics: Prometheus counters for the infra's alerts (repeated
 * admin sign-in failures). Only on this admin listener, never public.
 */
adminApp.get('/metrics', (c) =>
  c.text(renderAdminMetrics(), 200, {
    'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
  })
)

/** GET /admin: the panel (static: it reads everything through /admin/api). */
adminApp.get('/admin', (c) => {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  c.header(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
  )
  return c.html(adminPage(nonce))
})

/** GET /admin/sign-in: to Google, with this browser's flow cookie. */
adminApp.get('/admin/sign-in', async (c) => {
  const { settings } = storage(c)
  const { url, nonce } = await startAdminSignIn(c.env, settings.secret, c.req.url)
  setCookie(c, FLOW_COOKIE, nonce, {
    prefix: 'host',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
  })
  return c.redirect(url)
})

/**
 * GET /admin/callback: Google's answer. An allowlisted account gets a
 * session cookie; the page then navigates to /admin itself, so the Strict
 * cookie is sent (it isn't on the redirect chain that started at Google).
 */
adminApp.get('/admin/callback', async (c) => {
  const { settings, bucket } = storage(c)
  const account = await finishAdminSignIn(
    c.env,
    settings.secret,
    c.req.url,
    { code: c.req.query('code'), state: c.req.query('state') },
    getCookie(c, FLOW_COOKIE, 'host')
  )
  deleteCookie(c, FLOW_COOKIE, { prefix: 'host', path: '/', secure: true })
  const allowed = account !== null && isAllowedAdmin(c.env, account)
  countAdminSignIn(allowed ? 'success' : 'failure')
  await appendAudit(bucket, {
    at: Date.now(),
    admin: allowed ? account.email : null,
    action: allowed ? 'sign_in' : 'sign_in_refused',
    target: null,
    status: allowed ? 200 : 403,
    ...(account && !allowed && { after: { email: account.email } }),
  })
  if (!allowed) {
    return c.html(
      '<!doctype html><meta charset="utf-8"><title>Not allowed</title><p>This Google account may not use the admin panel.</p>',
      403
    )
  }
  setCookie(c, SESSION_COOKIE, await createAdminSession(account, settings.secret), {
    prefix: 'host',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  })
  return c.html(
    '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/admin"><title>Signed in</title><a href="/admin">Continue</a>'
  )
})

/**
 * Every /admin/api call: a live session of an allowlisted admin (else
 * 403, also when not signed in); for changes, the CSRF token and a
 * same-origin request (else 403). Then the call is audited, with what the
 * handler recorded as changed.
 */
adminApp.use('/admin/api/*', async (c, next) => {
  const { settings, bucket } = storage(c)
  const session = await readAdminSession(getCookie(c, SESSION_COOKIE, 'host'), settings.secret)
  const admin = session && isAllowedAdmin(c.env, session) ? session : null
  const entry = (status: number): AuditEntry => ({
    at: Date.now(),
    admin: admin?.email ?? null,
    action: `${c.req.method} ${c.req.path}`,
    target: c.req.path.match(/[0-9a-f]{64}/)?.[0] ?? null,
    status,
    ...c.get('audit'),
  })
  const refuse = async (code: string, message: string) => {
    await appendAudit(bucket, entry(403))
    return c.json({ error: message, code }, 403)
  }
  if (!admin) return refuse('forbidden', 'Sign in as an admin')
  if (
    MUTATING.has(c.req.method) &&
    (!csrfMatches(admin, c.req.header('X-CSRF-Token')) || !isSameOrigin(c))
  ) {
    return refuse('csrf', 'Missing or wrong CSRF token')
  }
  c.set('admin', admin)
  c.set('audit', {})
  try {
    await next()
  } finally {
    await appendAudit(bucket, entry(c.res.status))
  }
})

/** The account id in the path, and 404 unless the account exists. */
async function requireAccount(c: AdminContext) {
  const accountId = c.req.param('accountId') ?? ''
  if (!ACCOUNT_ID.test(accountId)) {
    throw new SyncError(400, 'invalid_request', 'Invalid account id')
  }
  const { bucket, settings } = storage(c)
  if (!(await bucket.get(accountRecordKey(accountId)))) {
    throw new SyncError(404, 'not_found', 'No such account')
  }
  return { accountId, bucket, settings }
}

/** Changes the account's record (CAS) and records its before/after in the audit. */
async function changeAccount<K extends keyof AccountRecord>(
  c: AdminContext,
  field: K,
  value: AccountRecord[K]
) {
  const { accountId, bucket, settings } = await requireAccount(c)
  const before = await updateAccount(bucket, accountId, (record) => {
    const previous = record[field]
    record[field] = value
    return previous
  })
  c.set('audit', { before: { [field]: before }, after: { [field]: value } })
  const { record } = await readAccount(bucket, accountId)
  return c.json(describeAccount(accountId, record, settings.limits))
}

adminApp.get('/admin/api/session', (c) => {
  const admin = c.get('admin')
  const { settings } = storage(c)
  return c.json({
    email: admin.email,
    csrfToken: admin.csrf,
    defaultQuotaBytes: settings.limits.quotaBytes,
    maxQuotaBytes: MAX_ADMIN_QUOTA_BYTES,
  })
})

adminApp.post('/admin/api/sign-out', (c) => {
  deleteCookie(c, SESSION_COOKIE, { prefix: 'host', path: '/', secure: true })
  return c.json({ signedOut: true })
})

/** GET /admin/api/accounts?query&page: the accounts, searchable by email. */
adminApp.get('/admin/api/accounts', async (c) => {
  const { bucket, settings } = storage(c)
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1)
  return c.json(
    await listAdminAccounts(bucket, settings, c.req.query('query') ?? '', page)
  )
})

/** GET /admin/api/accounts/:accountId: usage vs quota and every backup. */
adminApp.get('/admin/api/accounts/:accountId', async (c) => {
  const { accountId, bucket, settings } = await requireAccount(c)
  const { record } = await readAccount(bucket, accountId)
  return c.json({
    ...describeAccount(accountId, record, settings.limits),
    backups: [...record.backups]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(publicBackup),
  })
})

/** PUT …/quota { quotaBytes }: 0-50 GiB, or null for the default. */
adminApp.put('/admin/api/accounts/:accountId/quota', async (c) => {
  const { quotaBytes } = (await readJsonBody(c)) as { quotaBytes?: unknown }
  if (
    quotaBytes !== null &&
    !(Number.isSafeInteger(quotaBytes) && (quotaBytes as number) >= 0 && (quotaBytes as number) <= MAX_ADMIN_QUOTA_BYTES)
  ) {
    throw new SyncError(400, 'invalid_request', 'quotaBytes must be 0-50 GiB, or null')
  }
  return changeAccount(c, 'quotaBytes', quotaBytes as number | null)
})

/** PUT …/suspended { suspended }: pause or resume new uploads. */
adminApp.put('/admin/api/accounts/:accountId/suspended', async (c) => {
  const { suspended } = (await readJsonBody(c)) as { suspended?: unknown }
  if (typeof suspended !== 'boolean') {
    throw new SyncError(400, 'invalid_request', 'suspended must be a boolean')
  }
  return changeAccount(c, 'suspended', suspended)
})

/** POST …/reconcile: recompute the usage from the bucket now. */
adminApp.post('/admin/api/accounts/:accountId/reconcile', async (c) => {
  const { accountId, bucket } = await requireAccount(c)
  const result = await reconcileAccount(
    bucket,
    accountId,
    storage(c).settings.limits.retentionDays
  )
  c.set('audit', {
    before: { usedBytes: result.usedBytesBefore },
    after: { usedBytes: result.usedBytesAfter },
  })
  return c.json(result)
})

/** DELETE …/:accountId { confirm }: everything the account has; confirm = its email or id. */
adminApp.delete('/admin/api/accounts/:accountId', async (c) => {
  const { confirm } = (await readJsonBody(c)) as { confirm?: unknown }
  const { accountId, bucket } = await requireAccount(c)
  const { record } = await readAccount(bucket, accountId)
  if (typeof confirm !== 'string' || (confirm !== accountId && confirm !== record.email)) {
    throw new SyncError(400, 'confirmation_required', 'Type the account’s email to confirm')
  }
  const { deletedBackups } = await deleteAccount(bucket, accountId)
  c.set('audit', {
    before: { email: record.email, backups: record.backups.length, usedBytes: record.usedBytes },
    after: { deleted: true },
  })
  return c.json({ deletedBackups })
})

/** GET /admin/api/tombstones: what deleted accounts keep (limits only), until purged. */
adminApp.get('/admin/api/tombstones', async (c) => {
  const { bucket } = storage(c)
  const ids = (await bucket.list(TOMBSTONES_PREFIX)).map(({ key }) =>
    key.slice(TOMBSTONES_PREFIX.length, -'.json'.length)
  )
  const tombstones = await Promise.all(
    ids.filter((id) => ACCOUNT_ID.test(id)).map(async (accountId) => {
      const tombstone = await readTombstone(bucket, accountId)
      return tombstone && {
        accountId,
        ...tombstone,
        purgeAt: tombstone.deletedAt + TOMBSTONE_DAYS * 24 * 60 * 60 * 1000,
      }
    })
  )
  return c.json({ tombstones: tombstones.filter(Boolean) })
})

/** DELETE /admin/api/tombstones/:accountId: purge a deleted account's limits now. */
adminApp.delete('/admin/api/tombstones/:accountId', async (c) => {
  const accountId = c.req.param('accountId')
  if (!ACCOUNT_ID.test(accountId)) {
    throw new SyncError(400, 'invalid_request', 'Invalid account id')
  }
  const { bucket } = storage(c)
  const tombstone = await readTombstone(bucket, accountId)
  if (!tombstone) throw new SyncError(404, 'not_found', 'No such tombstone')
  await bucket.delete(tombstoneKey(accountId))
  c.set('audit', { before: tombstone, after: { purged: true } })
  return c.json({ purged: true })
})

/** GET /admin/api/audit?limit: the newest audit entries. */
adminApp.get('/admin/api/audit', async (c) => {
  const { bucket } = storage(c)
  const limit = Math.min(500, Math.max(1, Number(c.req.query('limit') ?? 100) || 100))
  return c.json({ entries: await readAudit(bucket, limit) })
})

adminApp.notFound((c) => c.json({ error: 'Not found' }, 404))

export default adminApp
