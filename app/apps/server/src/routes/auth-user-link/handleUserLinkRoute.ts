import { userLinkConfirmPage } from './userLinkConfirmPage'
import {
  buildUserAuthCookie,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from '../../middleware/auth'
import { isOpenedByUser } from '../../middleware/origins'
import { getUserByToken } from '../../service/users'
import { getServerPort } from '../../utils/serverPort'

type HandleCors = (req: Request, res: Response) => Response

const USER_LINK = /^\/api\/auth\/user\/([^/]+)$/

/**
 * A user's sign-in link (the QR code in Settings > Users and Phones):
 * - GET opened by the user (scanned, typed, pasted, as the browser says)
 *   signs this device in and goes to the app on the host it was opened from;
 * - any other GET asks first, with a button that posts the link back: one
 *   opened by another site's page, and every one over plain http on the
 *   network, where browsers don't say who opened it;
 * - POST (that button, origin-checked like every write) signs in.
 */
export async function handleUserLinkRoute(
  req: Request,
  url: URL,
  handleCors: HandleCors,
): Promise<Response | null> {
  const match = url.pathname.match(USER_LINK)
  if (!match?.[1] || (req.method !== 'GET' && req.method !== 'POST')) {
    return null
  }

  const token = decodeURIComponent(match[1])
  const user = await getUserByToken(token)
  if (!user || !user.isActive) {
    return handleCors(
      req,
      Response.json(
        { error: 'Invalid or inactive user token' },
        { status: 401 },
      ),
    )
  }

  if (req.method === 'GET' && !isOpenedByUser(req)) {
    return handleCors(req, userLinkConfirmPage(user.name, url.pathname))
  }

  const host = req.headers.get('host')?.split(':')[0] ?? 'localhost'
  return handleCors(
    req,
    new Response(null, {
      status: req.method === 'POST' ? 303 : 302,
      headers: {
        Location: `http://${host}:${getServerPort()}/`,
        'Set-Cookie': buildUserAuthCookie(
          req,
          token,
          SESSION_COOKIE_MAX_AGE_SECONDS,
        ),
      },
    }),
  )
}
