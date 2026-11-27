import type { RequestContext } from '../middleware'
import {
  createScreenLink,
  describeScreenLinkEndpoints,
  readScreenLinks,
  revokeScreenLinks,
  type ScreenLink,
  type ScreenLinkInfo,
} from '../service/screen-links'
import type { Permission } from '../service/users/types'

/** A link as answered: never its hash. */
const info = ({ tokenHash: _, ...link }: ScreenLink): ScreenLinkInfo => link

/**
 * Screen links (T-214): another device (a TV, a laptop) shows one of the
 * church's screens through the server of the phone or PC that made it,
 * over WebRTC, signed in with the link's token alone.
 * POST   /api/screen-links          { screenId } → link + token (control_room.control)
 * GET    /api/screen-links          → standing links (control_room.control)
 * DELETE /api/screen-links          → revokes every link (control_room.control)
 * DELETE /api/screen-links/:id      → revokes one (control_room.control)
 * GET    /api/screen-links/session  → the link the caller signed in with
 * GET    /api/screen-links/endpoints → where devices reach this PC (control_room.control)
 */
export async function handleScreenLinkRoutes(
  req: Request,
  url: URL,
  context: RequestContext | null,
  checkPermission: (permission: Permission) => Response | null,
): Promise<Response | null> {
  const { pathname } = url
  if (pathname === '/api/screen-links/session' && req.method === 'GET') {
    const link = context?.screenLink
    if (!link) {
      return Response.json({ error: 'Not a screen link' }, { status: 401 })
    }
    return Response.json({ data: info(link) })
  }

  if (pathname === '/api/screen-links/endpoints' && req.method === 'GET') {
    return (
      checkPermission('control_room.control') ??
      Response.json({ data: describeScreenLinkEndpoints() })
    )
  }

  if (pathname === '/api/screen-links' && req.method === 'POST') {
    const denied = checkPermission('control_room.control')
    if (denied) return denied
    const body = (await req.json().catch(() => null)) as {
      screenId?: unknown
    } | null
    const screenId = body?.screenId
    if (typeof screenId !== 'number' || !Number.isInteger(screenId)) {
      return Response.json(
        { error: 'screenId must be a screen id' },
        { status: 400 },
      )
    }
    return Response.json(
      { data: await createScreenLink(screenId) },
      { status: 201 },
    )
  }

  if (pathname === '/api/screen-links' && req.method === 'GET') {
    return (
      checkPermission('control_room.control') ??
      Response.json({ data: readScreenLinks().map(info) })
    )
  }

  const one = pathname.match(/^\/api\/screen-links(?:\/([\w-]+))?$/)
  if (one && req.method === 'DELETE') {
    const denied = checkPermission('control_room.control')
    if (denied) return denied
    const removed = revokeScreenLinks(one[1])
    if (one[1] && !removed) {
      return Response.json({ error: 'No such link' }, { status: 404 })
    }
    return Response.json({ data: { revoked: true } })
  }

  return null
}
