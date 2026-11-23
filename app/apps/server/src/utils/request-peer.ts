/**
 * The TCP peer address of each request, recorded by the server's `fetch`
 * handler (`server.requestIP(req)`), so code that only gets the Request can
 * tell whether it came from this machine. The Host and Origin headers can't:
 * any client on the LAN can send `Host: localhost`.
 */
const peers = new WeakMap<Request, string>()

export function setRequestPeer(req: Request, address: string | undefined) {
  if (address) peers.set(req, address)
}

export function getRequestPeer(req: Request): string | undefined {
  return peers.get(req)
}

/** Whether an address is this machine's loopback (IPv4, IPv6 or mapped). */
export function isLoopbackAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '')
  return normalized === '::1' || normalized.startsWith('127.')
}
