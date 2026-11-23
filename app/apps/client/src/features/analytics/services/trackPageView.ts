import { trackEvent } from './trackEvent'
import { getCurrentFeature, setCurrentRoute } from '../utils/currentRoute'

/**
 * A page resolved: remember its route pattern, and send a `$pageview` when
 * the path changed (not when only its search, like a song search, did).
 */
export function trackPageView(routeId: string, pathChanged: boolean): void {
  setCurrentRoute(routeId)
  if (pathChanged) trackEvent('$pageview', { feature: getCurrentFeature() })
}
