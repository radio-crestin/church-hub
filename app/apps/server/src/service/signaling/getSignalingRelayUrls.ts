import { getSignalingBaseUrl } from './signalingBaseUrl'
import { getLegacyBackendUrl } from '../backend'

/**
 * Every relay this computer opens its rooms on: its own and, when a release
 * moved to a new backend, the legacy one too, so phones paired and listener
 * links shared before the move still reach it. A backend set on this machine
 * (CHURCH_HUB_BACKEND_URL or CHURCH_HUB_SIGNALING_URL: development, tests, a
 * self-hosted backend) is the only one.
 */
export function getSignalingRelayUrls(): string[] {
  const own = getSignalingBaseUrl()
  const setHere =
    process.env.CHURCH_HUB_BACKEND_URL || process.env.CHURCH_HUB_SIGNALING_URL
  if (setHere) return [own]
  return [...new Set([own, getLegacyBackendUrl()])]
}
