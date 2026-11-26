import { normalizeIp, parseIp } from './parseIp'

export interface ClientIpInput {
  /** The TCP peer: the ingress controller when behind one. */
  peer: string
  /** The X-Forwarded-For header, if any. */
  forwardedFor: string | null
  /** Whether an address is a proxy we trust (TRUSTED_PROXY_CIDRS). */
  isTrustedProxy: (address: string) => boolean
}

/**
 * The visitor's address. X-Forwarded-For counts only when the peer itself is
 * a trusted proxy. It is then read from the right, skipping the entries our
 * own proxies wrote (addresses inside the trusted ranges): the first address
 * outside them is the visitor. Anything left of it is the client's own claim
 * and is never read. An entry that is not an IP means the chain can't be
 * trusted, so the peer stands in for the client.
 */
export function resolveClientIp(input: ClientIpInput): string {
  const peer = normalizeIp(input.peer)
  if (!input.forwardedFor || !input.isTrustedProxy(peer)) return peer
  const entries = input.forwardedFor
    .split(',')
    .map((entry) => normalizeIp(entry))
    .filter(Boolean)
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]
    if (!parseIp(entry)) return peer
    if (!input.isTrustedProxy(entry)) return entry
  }
  // Every hop is one of ours (a request from inside): the farthest one.
  return entries[0] ?? peer
}
