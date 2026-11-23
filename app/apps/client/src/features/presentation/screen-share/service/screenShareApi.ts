import { getApiUrl } from '~/config'
import { fetchJsonWithStatus } from '~/utils/fetcher'
import { getAuthHeaders } from '~/utils/getAuthHeaders'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:screen-share:api')

/** Puts the share on the screens; returns the token its frames are sent with. */
export async function startScreenShareSession(): Promise<string> {
  const { status, body } = await fetchJsonWithStatus<{
    data?: { token: string }
    error?: string
  }>('/api/screen-share/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (status !== 200 || !body.data) {
    throw new Error(body.error ?? `Screen share start failed (${status})`)
  }
  return body.data.token
}

export async function stopScreenShareSession(): Promise<void> {
  const { status, body } = await fetchJsonWithStatus<{ error?: string }>(
    '/api/screen-share/stop',
    { method: 'POST' },
  )
  if (status !== 200) {
    throw new Error(body.error ?? `Screen share stop failed (${status})`)
  }
}

/**
 * Sends one JPEG frame (the browser capture; the desktop app sends its own
 * from Rust). false once the server no longer takes frames: the share ended.
 */
export async function postScreenShareFrame(
  token: string,
  jpeg: Blob,
): Promise<boolean> {
  const response = await fetch(`${getApiUrl()}/api/screen-share/frame`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'image/jpeg',
      'X-Screen-Share-Token': token,
    },
    body: jpeg,
  })
  if (response.status === 409 || response.status === 403) return false
  if (!response.ok) logger.warn(`Frame refused: ${response.status}`)
  return true
}

/** The share as MJPEG, for an <img>; `session` makes each share a new URL. */
export function screenShareStreamUrl(session: number | string): string {
  return `${getApiUrl()}/api/screen-share/stream.mjpg?session=${session}`
}
