import { type LookupAddress, lookup } from 'node:dns'
import type { LookupFunction } from 'node:net'

import { isBlockedAddress } from './isBlockedAddress'

export const PRIVATE_ADDRESS_ERROR =
  'The link points to a private network address'

/**
 * The DNS lookup a link's connection uses. It resolves the host once and
 * refuses when any address is private, so the address that was checked is
 * the one connected to (no second lookup a host could answer differently).
 */
export const vettedLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error, '', 0)
      return
    }
    const list = addresses as LookupAddress[]
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      callback(new Error(PRIVATE_ADDRESS_ERROR), '', 0)
      return
    }
    if (options.all) {
      ;(callback as unknown as (e: null, a: LookupAddress[]) => void)(
        null,
        list,
      )
      return
    }
    callback(null, list[0].address, list[0].family)
  })
}
