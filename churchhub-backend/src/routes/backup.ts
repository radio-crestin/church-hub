import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { abortUpload } from '../backup/account/abortUpload'
import type { BackupContext } from '../backup/account/BackupContext'
import { completeUpload } from '../backup/account/completeUpload'
import { deleteAccount } from '../backup/account/deleteAccount'
import { deleteBackup } from '../backup/account/deleteBackup'
import {
  ACCOUNT_KEY_VERSION,
  deriveAccountKey,
} from '../backup/account/deriveAccountKey'
import { listBackups } from '../backup/account/listBackups'
import { presignDownload } from '../backup/account/presignDownload'
import { presignParts } from '../backup/account/presignParts'
import { revokeSessions } from '../backup/account/revokeSessions'
import { startUpload } from '../backup/account/startUpload'
import {
  authenticateBackupCaller,
  openBackupSession,
  refreshBackupSession,
} from '../backup/auth/backupSession'
import { finishBackupSignIn, startBackupSignIn } from '../backup/auth/backupSignIn'
import { backupOpenApi } from '../backup/backupOpenApi'
import { readBackupSettings } from '../backup/backupSettings'
import { handleBackupError } from '../backup/handleBackupError'
import { clientIp, enforceRateLimit } from '../backup/rateLimit'
import { createBackupBucket } from '../backup/storage/createBackupBucket'
import { readJsonBody } from '../sync/readJsonBody'
import type { Bindings } from '../types'

/** Pinned, so the docs page runs only the Scalar build it was checked with. */
const SCALAR_VERSION = '1.76.4'
const SCALAR_INTEGRITY =
  'sha384-28+p9NyLFAl2b71X2XembwoB3f1K1iY0PyATQvkWJJ9k8E3sFW8FeGMbguBzasxv'
/** Every /backup body is a small JSON object; backups never pass through. */
const BODY_MAX_BYTES = 16 * 1024

type BackupRequest = Context<{ Bindings: Bindings }>

/**
 * Church Hub Cloud backup (free, Google sign-in): the PC signs in, then
 * uploads its encrypted backups straight to a private bucket through
 * presigned URLs this service hands out after checking the account's
 * session and free tier. Documented at /backup/openapi.json.
 */
const backup = new Hono<{ Bindings: Bindings }>()

backup.onError(handleBackupError)
backup.use(
  '/backup/*',
  bodyLimit({
    maxSize: BODY_MAX_BYTES,
    onError: (c) =>
      c.json({ error: 'Request is too large', code: 'too_large' }, 413),
  })
)
backup.use('/backup/*', async (c, next) => {
  await enforceRateLimit(c.env, 'ip', clientIp(c))
  await next()
  // Answers carry tokens, keys and presigned URLs: never cached.
  c.header('Cache-Control', 'no-store')
})

function storage(c: BackupRequest) {
  const settings = readBackupSettings(c.env)
  return { settings, bucket: createBackupBucket(settings.bucket) }
}

/** The signed-in account behind the request, within its rate limit. */
async function signedIn(c: BackupRequest): Promise<BackupContext> {
  const { settings, bucket } = storage(c)
  const caller = await authenticateBackupCaller(
    bucket,
    settings,
    c.req.header('Authorization')
  )
  await enforceRateLimit(c.env, 'account', caller.accountId)
  return { settings, bucket, caller }
}

backup.get('/backup/openapi.json', (c) => c.json(backupOpenApi))

/** GET /backup/docs: the OpenAPI document, rendered by Scalar. */
backup.get('/backup/docs', (c) =>
  c.html(
    '<!doctype html><html><head><title>Church Hub Cloud backup</title>' +
      '<meta charset="utf-8"></head><body>' +
      '<script id="api-reference" data-url="/backup/openapi.json"></script>' +
      `<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}" integrity="${SCALAR_INTEGRITY}" crossorigin="anonymous"></script>` +
      '</body></html>'
  )
)

/** GET /backup/sign-in?returnUrl&nonce&challenge: to Google's account chooser. */
backup.get('/backup/sign-in', async (c) => {
  const { settings } = storage(c)
  return c.redirect(
    await startBackupSignIn(c.env, settings.secret, c.req.url, {
      returnUrl: c.req.query('returnUrl'),
      nonce: c.req.query('nonce'),
      challenge: c.req.query('challenge'),
    })
  )
})

/** GET /backup/callback: Google's answer, back to the PC with a grant. */
backup.get('/backup/callback', async (c) => {
  const { settings } = storage(c)
  return c.redirect(
    await finishBackupSignIn(c.env, settings.secret, c.req.url, {
      code: c.req.query('code'),
      state: c.req.query('state'),
      error: c.req.query('error'),
    })
  )
})

/** POST /backup/session { grant, verifier }: the PC's first session. */
backup.post('/backup/session', async (c) => {
  const body = (await readJsonBody(c)) as { grant?: unknown; verifier?: unknown }
  const { settings } = storage(c)
  return c.json(await openBackupSession(settings, body?.grant, body?.verifier))
})

/** POST /backup/session/refresh { refreshToken }: a new session. */
backup.post('/backup/session/refresh', async (c) => {
  const body = (await readJsonBody(c)) as { refreshToken?: unknown }
  const { settings, bucket } = storage(c)
  return c.json(await refreshBackupSession(bucket, settings, body?.refreshToken))
})

/** DELETE /backup/session: sign out everywhere (every token is refused). */
backup.delete('/backup/session', async (c) => {
  await revokeSessions(await signedIn(c))
  return c.json({ signedOut: true })
})

/** GET /backup/key: the account key the PC wraps each backup's key with. */
backup.get('/backup/key', async (c) => {
  const { settings, caller } = await signedIn(c)
  return c.json({
    keyVersion: ACCOUNT_KEY_VERSION,
    key: await deriveAccountKey(caller.sub, settings.keySecret),
  })
})

/** GET /backup/backups: the account's backups and its free-tier usage. */
backup.get('/backup/backups', async (c) =>
  c.json(await listBackups(await signedIn(c)))
)

/** POST /backup/uploads { sizeBytes, appVersion, keyVersion }: start one. */
backup.post('/backup/uploads', async (c) => {
  const body = (await readJsonBody(c)) as Record<string, unknown>
  return c.json(await startUpload(await signedIn(c), body ?? {}), 201)
})

/** POST /backup/uploads/:backupId/parts { partNumbers }: presigned part URLs. */
backup.post('/backup/uploads/:backupId/parts', async (c) => {
  const body = (await readJsonBody(c)) as { partNumbers?: unknown }
  return c.json(
    await presignParts(await signedIn(c), c.req.param('backupId'), body?.partNumbers)
  )
})

/** POST /backup/uploads/:backupId/complete: assemble, list, apply retention. */
backup.post('/backup/uploads/:backupId/complete', async (c) =>
  c.json({
    backup: await completeUpload(await signedIn(c), c.req.param('backupId')),
  })
)

/** DELETE /backup/uploads/:backupId: cancel an upload in flight. */
backup.delete('/backup/uploads/:backupId', async (c) => {
  await abortUpload(await signedIn(c), c.req.param('backupId'))
  return c.json({ aborted: true })
})

/** POST /backup/backups/:backupId/download: a presigned GET URL. */
backup.post('/backup/backups/:backupId/download', async (c) =>
  c.json(await presignDownload(await signedIn(c), c.req.param('backupId')))
)

/** DELETE /backup/backups/:backupId: delete one backup. */
backup.delete('/backup/backups/:backupId', async (c) => {
  await deleteBackup(await signedIn(c), c.req.param('backupId'))
  return c.json({ deleted: true })
})

/** DELETE /backup/account: delete every backup and sign out everywhere. */
backup.delete('/backup/account', async (c) =>
  c.json(await deleteAccount(await signedIn(c)))
)

export default backup
