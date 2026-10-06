import { BlockList, isIP } from 'node:net'

/** Set only by the e2e suite, whose stand-in S3 runs on 127.0.0.1. */
export const LOOPBACK_ALLOWED =
  process.env.CHURCH_HUB_ALLOW_LOOPBACK_LINKS === 'true'

function blockList(withLoopback: boolean): BlockList {
  const list = new BlockList()
  const v4: Array<[string, number]> = [
    ['0.0.0.0', 8], // "this network", unspecified
    ['10.0.0.0', 8], // private
    ['100.64.0.0', 10], // carrier-grade NAT
    ['169.254.0.0', 16], // link-local, cloud metadata
    ['172.16.0.0', 12], // private
    ['192.0.0.0', 24], // IETF protocol assignments
    ['192.168.0.0', 16], // private
    ['198.18.0.0', 15], // benchmarking
    ['224.0.0.0', 4], // multicast
    ['240.0.0.0', 4], // reserved, broadcast
  ]
  const v6: Array<[string, number]> = [
    ['::', 128], // unspecified
    ['fc00::', 7], // unique local
    ['fe80::', 10], // link-local
    ['ff00::', 8], // multicast
  ]
  if (withLoopback) {
    v4.push(['127.0.0.0', 8])
    v6.push(['::1', 128])
  }
  for (const [net, prefix] of v4) list.addSubnet(net, prefix, 'ipv4')
  for (const [net, prefix] of v6) list.addSubnet(net, prefix, 'ipv6')
  return list
}

const BLOCKED = blockList(!LOOPBACK_ALLOWED)

/**
 * Whether an IP address is on this machine or a private network, where a
 * shared link must never reach. IPv4-mapped IPv6 addresses are checked
 * against the IPv4 ranges.
 */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return true
  return BLOCKED.check(address, family === 4 ? 'ipv4' : 'ipv6')
}
