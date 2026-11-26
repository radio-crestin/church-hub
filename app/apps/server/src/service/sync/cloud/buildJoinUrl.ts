import { getPublicAppUrl } from './getPublicAppUrl'
import { getSyncServiceUrl } from './getSyncServiceUrl'
import { getRemoteAccessSettings } from '../../remote-access/remoteAccessSettings'

/**
 * The link (and QR code) a phone opens to join this church server (T-168):
 * `<public app>/join#c=<churchId>-<pathSecret>&t=<deviceToken>&p=<pcSignalId>`.
 * Everything sits in the fragment, so no server ever logs it. `p` is the
 * computer's remote access room, when that is on; `s` the sync service, only
 * when it isn't the default one (a self-hosted service).
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
  if (remoteAccess.enabled) params.set('p', remoteAccess.secret)
  if (input.serviceUrl !== getSyncServiceUrl()) {
    params.set('s', input.serviceUrl)
  }
  return `${getPublicAppUrl()}/join#${params}`
}
