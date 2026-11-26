/**
 * How the phone app finds the computer away from the church Wi-Fi: the
 * signaling relay and the computer's room there, read from the pairing QR
 * code's `#remote=<secret>&relay=<url>` (Settings > Phones with remote
 * access on).
 */
export interface RemotePairing {
  relay: string
  secret: string
}

const STORAGE_KEY = 'church-hub-remote-pairing'

/** https, or a relay on this machine (development and tests). */
function isRelayUrl(relay: string): boolean {
  try {
    const { protocol, hostname } = new URL(relay)
    return (
      protocol === 'https:' ||
      (protocol === 'http:' &&
        (hostname === '127.0.0.1' || hostname === 'localhost'))
    )
  } catch {
    return false
  }
}

/** The pairing in a scanned link's fragment, or null when it has none. */
export function parseRemotePairing(link: string): RemotePairing | null {
  const hash = link.split('#')[1]
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const secret = params.get('remote')
  const relay = params.get('relay')
  if (!secret || !relay || !isRelayUrl(relay)) return null
  return { secret, relay: relay.replace(/\/+$/, '') }
}

export function getRemotePairing(): RemotePairing | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as RemotePairing) : null
  } catch {
    return null
  }
}

/** Keeps the scanned link's pairing; a link without one forgets the old. */
export function storeRemotePairing(link: string) {
  const pairing = parseRemotePairing(link)
  if (pairing) localStorage.setItem(STORAGE_KEY, JSON.stringify(pairing))
  else localStorage.removeItem(STORAGE_KEY)
}
