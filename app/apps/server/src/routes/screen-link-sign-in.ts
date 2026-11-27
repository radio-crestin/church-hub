import { buildUserAuthCookie } from '../middleware'
import { findScreenLink } from '../service/screen-links'

/**
 * POST /api/screen-links/sign-in { token } → the link, and its token as the
 * `user_auth` cookie. A device on the church network that opened a direct
 * screen link (T-214) signs in with it: a browser sends a cookie, never an
 * X-User-Auth header of its own. A revoked or expired link is refused (401).
 */
export async function handleScreenLinkSignIn(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    token?: unknown
  } | null
  const token = typeof body?.token === 'string' ? body.token : ''
  const link = token ? await findScreenLink(token) : null
  if (!link) {
    return Response.json({ error: 'Not a standing screen link' }, { status: 401 })
  }
  const maxAgeSeconds = Math.floor((link.expiresAt - Date.now()) / 1000)
  const { tokenHash: _, ...info } = link
  return Response.json(
    { data: info },
    {
      headers: {
        'Set-Cookie': buildUserAuthCookie(req, token, maxAgeSeconds),
      },
    },
  )
}
