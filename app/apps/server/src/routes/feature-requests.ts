import type { RequestContext } from '../middleware/types'
import { forwardFeatureRequest } from '../service/feature-request'
import { createLogger } from '../utils/logger'

type HandleCors = (req: Request, res: Response) => Response

const logger = createLogger('feature-requests')

export const FEATURE_REQUESTS_PATH = '/api/feature-requests'

/**
 * POST /api/feature-requests — "Request a feature" from the app. Any
 * signed-in user (or the app itself) may send one; the body is relayed to
 * the Cloudflare worker, which validates it, opens the public GitHub issue
 * and notifies the maintainer on WhatsApp.
 */
export async function handleFeatureRequestRoutes(
  req: Request,
  url: URL,
  handleCors: HandleCors,
  context: RequestContext | null,
): Promise<Response | null> {
  if (url.pathname !== FEATURE_REQUESTS_PATH || req.method !== 'POST') {
    return null
  }

  const respond = (status: number, payload: unknown): Response =>
    handleCors(
      req,
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

  if (!context) return respond(401, { success: false, error: 'Unauthorized' })

  try {
    const { status, payload } = await forwardFeatureRequest(await req.text())
    return respond(status, payload)
  } catch (error) {
    logger.error(`Forwarding the feature request failed: ${error}`)
    return respond(502, {
      success: false,
      error: 'Could not reach the Church Hub backend',
    })
  }
}
