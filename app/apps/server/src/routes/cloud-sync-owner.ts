import {
  acceptCloudChurch,
  completeOwnerSignIn,
  keepCloudChurch,
  listOwnerChurches,
  type OwnerSignInIntent,
  recoverCloudChurch,
  resetCloudChurch,
  setOwnerSession,
  startOwnerSignIn,
  transferCloudChurch,
} from '../service/sync'
import { escapeHtml } from '../service/text-search/text/escapeHtml'
import { createLogger } from '../utils/logger'
import { toErrorMessage } from '../utils/toErrorMessage'

const logger = createLogger('sync')

const INTENTS: OwnerSignInIntent[] = ['connect', 'claim', 'manage', 'curate']
const CHURCH_PATH =
  /^\/api\/sync\/cloud\/owner\/churches\/([A-Za-z0-9_-]{1,64})\/(recover|transfer|accept)$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Errors the user acts on (sign in again, pick a PC…), with their status. */
const STATUS_BY_ERROR: Record<string, number> = {
  already_connected: 409,
  not_connected: 409,
  server_in_use: 409,
  owner_sign_in_required: 401,
}

/**
 * The answer to a failed owner action: the user's own errors as mapped, the
 * service's refusals of the owner (401 sign in again, 403 not the owner,
 * 409…) with their status, anything else 502.
 */
function failure(error: unknown): Response {
  const message = toErrorMessage(error)
  const refused = Number(message.match(/^Sync service (4\d\d) /)?.[1])
  const status = STATUS_BY_ERROR[message] ?? (refused || 502)
  if (status === 502)
    logger.error(`Cloud sync owner request failed: ${message}`)
  return Response.json({ error: message }, { status })
}

async function answer(work: () => Promise<unknown>): Promise<Response> {
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

/**
 * The church's owner on this PC (T-172), localhost only:
 * POST /api/sync/cloud/owner/sign-in              { intent, serviceUrl? } → { authUrl }
 * GET  /api/sync/cloud/owner/callback             the sign-in's return (HTML)
 * POST /api/sync/cloud/owner/sign-out
 * GET  /api/sync/cloud/owner/churches             the owner's church servers
 * POST /api/sync/cloud/owner/churches/:id/recover this PC becomes its server
 * POST /api/sync/cloud/owner/churches/:id/transfer { email }
 * POST /api/sync/cloud/owner/churches/:id/accept
 * POST /api/sync/cloud/owner/reset                revoke every device, new path
 * POST /api/sync/cloud/keep                       { here } after server_in_use
 */
export async function handleCloudSyncOwnerRoutes(
  req: Request,
  url: URL,
): Promise<Response | null> {
  const { pathname } = url
  const post = req.method === 'POST'

  if (pathname === '/api/sync/cloud/owner/sign-in' && post) {
    const body = (await req.json().catch(() => ({}))) as {
      intent?: unknown
      serviceUrl?: unknown
    }
    const intent = body.intent as OwnerSignInIntent
    if (!INTENTS.includes(intent)) {
      return Response.json({ error: 'intent is required' }, { status: 400 })
    }
    const serviceUrl =
      typeof body.serviceUrl === 'string' && body.serviceUrl
        ? body.serviceUrl
        : undefined
    return answer(() => startOwnerSignIn(intent, serviceUrl))
  }

  if (pathname === '/api/sync/cloud/owner/callback' && req.method === 'GET') {
    try {
      const { email } = await completeOwnerSignIn({
        nonce: url.searchParams.get('nonce'),
        ticket: url.searchParams.get('ticket'),
        expiresAt: url.searchParams.get('expiresAt'),
        error: url.searchParams.get('error'),
      })
      return callbackPage(
        `Signed in as ${email}. You can close this window and return to Church Hub.`,
        `Te-ai conectat ca ${email}. Poți închide fereastra și reveni în Church Hub.`,
      )
    } catch (error) {
      const message = toErrorMessage(error)
      logger.warning(`Owner sign-in refused: ${message}`)
      return callbackPage(
        `Sign-in failed: ${message}`,
        `Conectarea nu a reușit: ${message}`,
      )
    }
  }

  if (pathname === '/api/sync/cloud/owner/sign-out' && post) {
    setOwnerSession(null)
    return Response.json({ data: { signedOut: true } })
  }

  if (pathname === '/api/sync/cloud/owner/churches' && req.method === 'GET') {
    return answer(listOwnerChurches)
  }

  if (pathname === '/api/sync/cloud/owner/reset' && post) {
    return answer(resetCloudChurch)
  }

  const church = pathname.match(CHURCH_PATH)
  if (church && post) {
    const [, churchId, action] = church as [string, string, string]
    if (action === 'recover') return answer(() => recoverCloudChurch(churchId))
    if (action === 'accept') return answer(() => acceptCloudChurch(churchId))
    const body = (await req.json().catch(() => ({}))) as { email?: unknown }
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL.test(email)) {
      return Response.json({ error: 'invalid_email' }, { status: 400 })
    }
    return answer(() => transferCloudChurch(churchId, email))
  }

  if (pathname === '/api/sync/cloud/keep' && post) {
    const body = (await req.json().catch(() => ({}))) as { here?: unknown }
    if (typeof body.here !== 'boolean') {
      return Response.json({ error: 'here must be a boolean' }, { status: 400 })
    }
    const here = body.here
    return answer(async () => {
      await keepCloudChurch(here)
      return { kept: here }
    })
  }

  return null
}
