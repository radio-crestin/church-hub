import { DEFAULT_SYNC_SERVICE_URL } from './defaultSyncServiceUrl'

export interface JoinLink {
  serviceUrl: string
  churchId: string
  token: string
  pcSignalId: string | null
}

/** A church id is 12 random bytes in base64url; the path secret follows it. */
const CHURCH = /^([A-Za-z0-9_-]{16})-[A-Za-z0-9_-]{43}$/

/** https, or a service on this machine (development and tests). */
function isServiceUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value)
    return (
      protocol === 'https:' ||
      (protocol === 'http:' &&
        (hostname === '127.0.0.1' || hostname === 'localhost'))
    )
  } catch {
    return false
  }
}

/**
 * The join link's fragment, `#c=<churchId>-<pathSecret>&t=<deviceToken>`
 * plus `&p=<pcSignalId>` and `&s=<sync service>` when given; null when it
 * isn't one.
 */
export function parseJoinLink(hash: string): JoinLink | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const churchId = params.get('c')?.match(CHURCH)?.[1]
  const token = params.get('t')
  const serviceUrl = params.get('s') ?? DEFAULT_SYNC_SERVICE_URL
  if (!churchId || !token || !isServiceUrl(serviceUrl)) return null
  return {
    serviceUrl: serviceUrl.replace(/\/+$/, ''),
    churchId,
    token,
    pcSignalId: params.get('p'),
  }
}
