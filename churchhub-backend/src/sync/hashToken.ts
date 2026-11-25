/**
 * Keyed hash (HMAC-SHA-256) of a device token: the central state keeps only
 * this, so a leaked state cannot be replayed as tokens.
 */
export async function hashToken(
  token: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(token))
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}
