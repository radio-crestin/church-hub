import type { Bindings } from '../types'
import { DEFAULT_WAHA_SESSION } from './constants'

/**
 * Sends a text through WAHA (WhatsApp HTTP API) `POST /api/sendText`.
 * When WAHA sits behind Cloudflare Access, the service-token headers are
 * added too. Returns false (and logs why) instead of throwing: the GitHub
 * issue already exists, so a WhatsApp outage must not fail the request.
 */
export async function sendWhatsAppMessage(
  env: Bindings,
  text: string
): Promise<boolean> {
  if (!env.WAHA_URL || !env.WAHA_API_KEY || !env.WAHA_CHAT_ID) {
    console.warn('[feature-requests] WAHA is not configured; skipping WhatsApp')
    return false
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': env.WAHA_API_KEY,
  }
  if (env.WAHA_ACCESS_CLIENT_ID && env.WAHA_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = env.WAHA_ACCESS_CLIENT_ID
    headers['CF-Access-Client-Secret'] = env.WAHA_ACCESS_CLIENT_SECRET
  }

  try {
    const response = await fetch(
      `${env.WAHA_URL.replace(/\/+$/, '')}/api/sendText`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session: env.WAHA_SESSION || DEFAULT_WAHA_SESSION,
          chatId: env.WAHA_CHAT_ID,
          text,
        }),
      }
    )
    if (!response.ok) {
      console.error(
        '[feature-requests] WAHA sendText failed:',
        response.status,
        await response.text()
      )
    }
    return response.ok
  } catch (error) {
    console.error('[feature-requests] WAHA unreachable:', error)
    return false
  }
}
