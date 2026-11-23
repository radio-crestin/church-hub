/**
 * Test-only stand-in for the church network. With CHURCH_HUB_TEST_LAN_PORT
 * set, the server also listens on 127.0.0.1:<that port>, and requests there
 * count as coming from a LAN device (TEST_LAN_PEER), so the e2e suite tests
 * LAN sign-in and guards without binding a LAN interface (T-193).
 */
const TEST_LAN_PEER = '192.0.2.10'

export function getTestLanPort(): number | undefined {
  const port = Number(process.env.CHURCH_HUB_TEST_LAN_PORT)
  return port > 0 ? port : undefined
}

/** The request's peer: the TCP peer, or the LAN stand-in's on its port. */
export function peerAddress(
  req: Request,
  server: {
    port?: number
    requestIP(req: Request): { address: string } | null
  },
): string | undefined {
  if (server.port !== undefined && server.port === getTestLanPort()) {
    return TEST_LAN_PEER
  }
  return server.requestIP(req)?.address
}
