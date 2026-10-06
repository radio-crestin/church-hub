import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { isBlockedAddress } from './isBlockedAddress'
import { requireLinkUrl } from './requireLinkUrl'

/**
 * Throws unless a link is https and every address its host resolves to is
 * public, so a shared link cannot make this machine fetch from itself or
 * from the church's private network.
 */
export async function assertPublicUrl(value: string | URL): Promise<URL> {
  const url = requireLinkUrl(value.toString())
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address)
  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw new Error('The link points to a private network address')
  }
  return url
}
