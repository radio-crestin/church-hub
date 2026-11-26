/** An IP address as a number and its family, or null when it isn't one. */
export interface ParsedIp {
  family: 4 | 6
  value: bigint
}

/** `::ffff:1.2.3.4` (an IPv4 client on a dual-stack socket) → `1.2.3.4`. */
export function normalizeIp(address: string): string {
  const trimmed = address.trim()
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed)
  return mapped ? mapped[1] : trimmed
}

export function parseIp(address: string): ParsedIp | null {
  const ip = normalizeIp(address)
  return ip.includes(':') ? parseIpv6(ip) : parseIpv4(ip)
}

function parseIpv4(ip: string): ParsedIp | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0n
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null
    value = (value << 8n) | BigInt(part)
  }
  return { family: 4, value }
}

function parseIpv6(ip: string): ParsedIp | null {
  const halves = ip.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const groups = [...head, ...Array(Math.max(missing, 0)).fill('0'), ...tail]
  let value = 0n
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
    value = (value << 16n) | BigInt(parseInt(group, 16))
  }
  return { family: 6, value }
}
