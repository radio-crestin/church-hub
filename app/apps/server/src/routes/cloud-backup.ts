import {
  CLOUD_BACKUP_INTERVALS,
  CloudBackupError,
  completeCloudBackupSignIn,
  deleteCloudBackup,
  getCloudBackupStatus,
  listCloudBackups,
  restoreCloudBackup,
  signOutCloudBackup,
  startCloudBackupSignIn,
  updateCloudBackupSchedule,
  uploadCloudBackup,
} from '../service/backup/cloud'
import { escapeHtml } from '../service/text-search/text/escapeHtml'
import { createLogger } from '../utils/logger'

const logger = createLogger('backup')

const BACKUP_PATH = /^\/api\/backup\/cloud\/backups\/([A-Za-z0-9_-]{22})$/
const RESTORE_PATH =
  /^\/api\/backup\/cloud\/backups\/([A-Za-z0-9_-]{22})\/restore$/

/** A failure as `{ error: <code> }`: the service's codes, never its URLs or tokens. */
function failure(error: unknown): Response {
  if (error instanceof CloudBackupError) {
    if (error.status >= 500) logger.error(`Cloud backup failed: ${error.code}`)
    return Response.json({ error: error.code }, { status: error.status })
  }
  logger.error(
    `Cloud backup failed: ${error instanceof Error ? error.message : 'unknown'}`,
  )
  return Response.json({ error: 'cloud_backup_failed' }, { status: 500 })
}

async function answer(work: () => unknown): Promise<Response> {
  try {
    return Response.json({ data: await work() })
  } catch (error) {
    return failure(error)
  }
}

/** The page the browser lands on after the sign-in, in both app languages. */
function callbackPage(english: string, romanian: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Church Hub</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><p>${escapeHtml(english)}</p><p>${escapeHtml(romanian)}</p><script>setTimeout(()=>window.close(),1500)</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

/** PUT config: the automatic schedule's switch and interval, validated. */
async function updateSchedule(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    autoBackupEnabled?: unknown
    intervalHours?: unknown
  }
  const patch: { autoBackupEnabled?: boolean; intervalHours?: number } = {}
  if (body.autoBackupEnabled !== undefined) {
    if (typeof body.autoBackupEnabled !== 'boolean') {
      return Response.json({ error: 'invalid_request' }, { status: 400 })
    }
    patch.autoBackupEnabled = body.autoBackupEnabled
  }
  if (body.intervalHours !== undefined) {
    if (!CLOUD_BACKUP_INTERVALS.includes(body.intervalHours as number)) {
      return Response.json({ error: 'invalid_request' }, { status: 400 })
    }
    patch.intervalHours = body.intervalHours as number
  }
  return answer(() => updateCloudBackupSchedule(patch))
}

/**
 * Church Hub Cloud backup on this PC, localhost only (the caller guards):
 * GET    /api/backup/cloud/status                 signed in?, email, schedule
 * POST   /api/backup/cloud/sign-in                → { authUrl }
 * GET    /api/backup/cloud/callback               the sign-in's return (HTML)
 * POST   /api/backup/cloud/sign-out               { deleteBackups }
 * PUT    /api/backup/cloud/config                 { autoBackupEnabled?, intervalHours? }
 * GET    /api/backup/cloud/backups                → { backups, usage }
 * POST   /api/backup/cloud/backups                back up now → { backup }
 * POST   /api/backup/cloud/backups/:id/restore    → { requiresRestart }
 * DELETE /api/backup/cloud/backups/:id
 */
export async function handleCloudBackupRoutes(
  req: Request,
  url: URL,
): Promise<Response | null> {
  const { pathname } = url
  const { method } = req

  if (pathname === '/api/backup/cloud/status' && method === 'GET') {
    return answer(getCloudBackupStatus)
  }
  if (pathname === '/api/backup/cloud/sign-in' && method === 'POST') {
    return answer(startCloudBackupSignIn)
  }
  if (pathname === '/api/backup/cloud/callback' && method === 'GET') {
    try {
      const email = await completeCloudBackupSignIn({
        nonce: url.searchParams.get('nonce'),
        grant: url.searchParams.get('grant'),
        error: url.searchParams.get('error'),
      })
      return callbackPage(
        `Signed in to Church Hub Cloud as ${email}. You can close this window and return to Church Hub.`,
        `Te-ai conectat la Church Hub Cloud ca ${email}. Poți închide această fereastră și te poți întoarce la Church Hub.`,
      )
    } catch (error) {
      const code =
        error instanceof CloudBackupError ? error.code : 'sign_in_failed'
      logger.warning(`Cloud backup sign-in refused: ${code}`)
      return callbackPage(
        `Sign-in failed: ${code}`,
        `Conectarea nu a reușit: ${code}`,
      )
    }
  }
  if (pathname === '/api/backup/cloud/sign-out' && method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as {
      deleteBackups?: unknown
    }
    return answer(() => signOutCloudBackup(body.deleteBackups === true))
  }
  if (pathname === '/api/backup/cloud/config' && method === 'PUT') {
    return updateSchedule(req)
  }
  if (pathname === '/api/backup/cloud/backups') {
    if (method === 'GET') return answer(listCloudBackups)
    if (method === 'POST') {
      return answer(async () => ({ backup: await uploadCloudBackup() }))
    }
  }
  const restore = pathname.match(RESTORE_PATH)
  if (restore && method === 'POST') {
    return answer(() => restoreCloudBackup(restore[1] as string))
  }
  const single = pathname.match(BACKUP_PATH)
  if (single && method === 'DELETE') {
    return answer(async () => {
      await deleteCloudBackup(single[1] as string)
      return { deleted: true }
    })
  }
  return null
}
