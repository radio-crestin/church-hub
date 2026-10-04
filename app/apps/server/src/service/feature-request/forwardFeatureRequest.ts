import { createLogger } from '../../utils/logger'

const logger = createLogger('feature-request')

const DEFAULT_BACKEND_URL = 'https://churchub-backend.radiocrestin.ro'
const FORWARD_TIMEOUT_MS = 30_000

export interface ForwardedResponse {
  status: number
  payload: unknown
}

/**
 * Relays a "Request a feature" submission to the Church Hub Cloudflare
 * worker (`POST /feature-requests`), which owns the GitHub token and the
 * WhatsApp settings. The app never holds those secrets. The worker's status
 * and JSON body are passed back unchanged so the client sees its errors.
 */
export async function forwardFeatureRequest(
  rawBody: string,
): Promise<ForwardedResponse> {
  const backendUrl = process.env.YOUTUBE_OAUTH_SERVER || DEFAULT_BACKEND_URL
  logger.debug(`Forwarding feature request to ${backendUrl}`)

  const response = await fetch(`${backendUrl}/feature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
    signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
  })
  const payload = await response.json().catch(() => ({
    success: false,
    error: `Backend responded with ${response.status}`,
  }))
  if (!response.ok) {
    logger.warning(`Backend rejected feature request: ${response.status}`)
  }
  return { status: response.status, payload }
}
