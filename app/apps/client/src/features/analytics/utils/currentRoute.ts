/**
 * The page the user is on, as its route pattern (`/songs/$songId`), never
 * the address itself: ids, names and the server's address stay out of the
 * analytics. Set by the router each time a page resolves.
 */
let route = '/'
let known = false

export function setCurrentRoute(routeId: string): void {
  // Pathless layout groups like `/(root)` are not part of the page's path.
  const path = routeId.replace(/\/\([^)]*\)/g, '').replace(/\/$/, '')
  route = path || '/'
  known = true
}

/** Whether a page has resolved yet. */
export function isRouteKnown(): boolean {
  return known
}

export function getCurrentRoute(): string {
  return route
}

/** The feature a route belongs to: its first segment (`songs`, `bible`). */
export function getCurrentFeature(): string {
  return route.split('/')[1] || 'home'
}
