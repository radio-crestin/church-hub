import { networkInterfaces } from 'node:os'

/**
 * This machine's first non-loopback IPv4 address. The test server listens on
 * every interface, so a request to it comes from a non-loopback peer, as a
 * phone or another computer on the church network would: the server judges
 * "local" by the TCP peer, so a Host header alone can't fake it.
 */
export function lanAddress(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address
    }
  }
  throw new Error('No non-loopback IPv4 address to reach the server by')
}

/** The test server's URL by this machine's LAN address. */
export function lanBaseUrl(baseURL: string): string {
  return `http://${lanAddress()}:${new URL(baseURL).port}`
}
