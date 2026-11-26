import { requirePermission } from '../middleware/permissions'
import type { RequestContext } from '../middleware/types'
import {
  dismissResetFeatures,
  getSecretStoreStatus,
} from '../service/secret-store'

type HandleCors = (req: Request, res: Response) => Response

/**
 * Where this computer keeps the key its saved passwords and API keys are
 * sealed with, and what a restore from another computer left to set up
 * again.
 *
 * - GET    /api/secret-store                 the status (settings.view)
 * - DELETE /api/secret-store/reset-features  dismiss the restore notice (settings.edit)
 */
export async function handleSecretStoreRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  const { pathname } = url
  if (!pathname.startsWith('/api/secret-store')) return null

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  if (!context) return respond(401, { error: 'Unauthorized' })

  if (req.method === 'GET' && pathname === '/api/secret-store') {
    const denied = requirePermission('settings.view')(context)
    if (denied) return handleCors(req, denied)
    return respond(200, { data: getSecretStoreStatus() })
  }

  if (
    req.method === 'DELETE' &&
    pathname === '/api/secret-store/reset-features'
  ) {
    const denied = requirePermission('settings.edit')(context)
    if (denied) return handleCors(req, denied)
    dismissResetFeatures()
    return respond(200, { data: { success: true } })
  }

  return null
}
