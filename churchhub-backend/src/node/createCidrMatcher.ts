import { parseIp } from './parseIp'

/**
 * A test for "is this address inside one of these CIDRs" (comma-separated,
 * IPv4 and IPv6). An empty list matches nothing; a malformed entry throws,
 * so a typo in TRUSTED_PROXY_CIDRS stops the server instead of trusting all.
 */
export function createCidrMatcher(list: string): (address: string) => boolean {
  const ranges = list
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseCidr)
  return (address) => {
    const ip = parseIp(address)
    if (!ip) return false
    return ranges.some(
      (range) =>
        range.family === ip.family && (ip.value & range.mask) === range.network
    )
  }
}

function parseCidr(cidr: string) {
  const [address, prefixText] = cidr.split('/')
  const ip = parseIp(address)
  const bits = ip?.family === 6 ? 128 : 32
  const prefix = prefixText === undefined ? bits : Number(prefixText)
  if (!ip || !Number.isInteger(prefix) || prefix < 0 || prefix > bits) {
    throw new Error(`Invalid CIDR in TRUSTED_PROXY_CIDRS: ${cidr}`)
  }
  const all = (1n << BigInt(bits)) - 1n
  const mask = all ^ ((1n << BigInt(bits - prefix)) - 1n)
  return { family: ip.family, mask, network: ip.value & mask }
}
