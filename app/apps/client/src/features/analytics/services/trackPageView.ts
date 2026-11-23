import { trackEvent } from './trackEvent'
import { getCurrentFeature, setCurrentRoute } from '../utils/currentRoute'

/** A page resolved: remember its route pattern and send a `$pageview`. */
export function trackPageView(routeId: string): void {
  setCurrentRoute(routeId)
  trackEvent('$pageview', { feature: getCurrentFeature() })
}
