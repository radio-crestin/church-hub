import { networkInterfaces } from 'os'

/**
 * Gets the internal IP address of the server
 * Returns the first non-internal IPv4 address found
 */
export function getInternalIp(): string {
  const nets = networkInterfaces()

  for (const name of Object.keys(nets)) {
    const netGroup = nets[name]
    if (!netGroup) continue

    for (const net of netGroup) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }

  // Fallback to localhost if no internal IP found
  return '127.0.0.1'
}
