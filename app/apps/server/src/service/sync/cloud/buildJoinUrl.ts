import { getPublicAppUrl } from './getPublicAppUrl'
import { getRemoteAccessSettings } from '../../remote-access/remoteAccessSettings'
import { getSignalingBaseUrl } from '../../signaling/signalingBaseUrl'

/**
 * The link (and QR code) a phone opens to join this church server (T-168):
 * `<public app>/join#c=<churchId>-<pathSecret>&t=<deviceToken>&p=<pcSignalId>`.
 * Everything sits in the fragment, so no server ever logs it. `p` is the
 * computer's remote access room, when that is on, where the phone reaches
 * it over WebRTC (T-174); `r` the signaling relay of that room, only when it
 * isn't the sync service; `s` the sync service, always: the public app reads
 * a link without it (a released version's) as the legacy backend's, and this
 * church may be on another one.
 */
export function buildJoinUrl(input: {
  readUrl: string
  token: string
  serviceUrl: string
}): string {
  // The read URL ends in the church's prefix, `churches/<churchId>-<pathSecret>`.
  const church = input.readUrl.replace(/\/+$/, '').split('/').pop() ?? ''
  const params = new URLSearchParams({ c: church, t: input.token })
  const remoteAccess = getRemoteAccessSettings()
  if (remoteAccess.enabled) {
    params.set('p', remoteAccess.secret)
    const relay = getSignalingBaseUrl()
    if (relay !== input.serviceUrl) params.set('r', relay)
  }
  params.set('s', input.serviceUrl)
  return `${getPublicAppUrl()}/join#${params}`
}
