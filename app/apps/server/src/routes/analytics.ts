import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import {
  getAnalyticsConfig,
  upsertAnalyticsEnabled,
} from '../service/analytics'

type HandleCors = (req: Request, res: Response) => Response

export const ANALYTICS_PATH = '/api/analytics'

function respond(
  req: Request,
  handleCors: HandleCors,
  status: number,
  payload: unknown,
): Response {
  return handleCors(
    req,
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

/**
 * GET /api/analytics (PUBLIC) — whether anonymous usage data may be sent,
 * and the random install id. Public because the client decides before any
 * login whether to start PostHog at all.
 */
export function handleAnalyticsConsentRead(
  req: Request,
  url: URL,
  handleCors: HandleCors,
): Response | null {
  if (url.pathname !== ANALYTICS_PATH || req.method !== 'GET') return null
  return respond(req, handleCors, 200, { data: getAnalyticsConfig() })
}

/** PUT /api/analytics `{ enabled }` — turns usage data on or off (settings.edit). */
export async function handleAnalyticsRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  if (url.pathname !== ANALYTICS_PATH || req.method !== 'PUT') return null
  if (!context) return respond(req, handleCors, 401, { error: 'Unauthorized' })
  const denied = requirePermission('settings.edit')(context)
  if (denied) return handleCors(req, denied)

  const body = (await req.json().catch(() => null)) as {
    enabled?: unknown
  } | null
  if (typeof body?.enabled !== 'boolean') {
    return respond(req, handleCors, 400, {
      error: '`enabled` must be a boolean',
    })
  }
  return respond(req, handleCors, 200, {
    data: upsertAnalyticsEnabled(body.enabled),
  })
}
