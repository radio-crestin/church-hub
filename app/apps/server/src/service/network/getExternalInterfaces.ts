import os from 'node:os'

export interface NetworkInterface {
  name: string
  address: string
  family: 'IPv4' | 'IPv6'
}

/**
 * Gets all external (non-internal) IPv4 network interfaces
 * Returns a list of interface names and their IP addresses
 */
export function getExternalInterfaces(): NetworkInterface[] {
  const interfaces = os.networkInterfaces()
  const result: NetworkInterface[] = []

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue

    for (const addr of addrs) {
      // Only include external IPv4 addresses
      if (!addr.internal && addr.family === 'IPv4') {
        result.push({
          name,
          address: addr.address,
          family: 'IPv4',
        })
      }
    }
  }

  return result
}
