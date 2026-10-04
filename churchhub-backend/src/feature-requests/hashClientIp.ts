/**
 * Keyed hash (HMAC-SHA-256) of the client IP, so the rate-limit store
 * never holds a raw IP and a plain hash cannot be reversed by trying every
 * IPv4 address. Keyed with the worker's existing COOKIE_ENCRYPTION_KEY.
 */
export async function hashClientIp(ip: string, secret: string): Promise<string> {
  if (!secret) throw new Error('COOKIE_ENCRYPTION_KEY is not configured')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ip))
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}
