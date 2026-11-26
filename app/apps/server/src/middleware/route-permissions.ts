import type { Permission } from '../service/users'

/**
 * The permission a route needs: one, or any one of several. A route group
 * lists every route it answers, so a route nobody listed is refused rather
 * than left open.
 */
export interface RoutePermission {
  method: string
  path: string | RegExp
  permission: Permission | Permission[]
}

/** The checker index.ts hands to route groups: null when permitted. */
export type CheckPermission = (permission: Permission) => Response | null

function matches(rule: RoutePermission, req: Request, pathname: string) {
  if (rule.method !== req.method) return false
  return typeof rule.path === 'string'
    ? rule.path === pathname
    : rule.path.test(pathname)
}

/**
 * Checks a request of a route group against the group's table: null when
 * its permission (any one, for a list) is granted, else the refusal; a
 * route missing from the table is answered 404.
 */
export function checkRoutePermission(
  req: Request,
  pathname: string,
  table: RoutePermission[],
  checkPermission: CheckPermission,
): Response | null {
  const rule = table.find((candidate) => matches(candidate, req, pathname))
  if (!rule) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  const required = [rule.permission].flat()
  const refusals = required.map(checkPermission)
  return refusals.includes(null) ? null : (refusals[0] ?? null)
}
