/**
 * Loopback listeners whose connections stand for a device elsewhere: the
 * e2e suite's LAN stand-in (testLanListener.ts) and the phones' WebRTC
 * tunnel (service/remote-access). Their requests get that device's address,
 * so the server never takes them for this machine.
 */
const standInPeers = new Map<number, string>()

export function registerStandInListener(port: number, peer: string) {
  standInPeers.set(port, peer)
}

/** The request's peer: the TCP peer, or the stand-in's on its port. */
export function peerAddress(
  req: Request,
  server: {
    port?: number
    requestIP(req: Request): { address: string } | null
  },
): string | undefined {
  const standIn =
    server.port === undefined ? undefined : standInPeers.get(server.port)
  return standIn ?? server.requestIP(req)?.address
}
