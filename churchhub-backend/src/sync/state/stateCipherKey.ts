const keys = new Map<string, Promise<CryptoKey>>()

/**
 * The AES-256-GCM key that encrypts every church state, derived from
 * SYNC_SECRET with HKDF (so it differs from the token hashes' HMAC key).
 * `info` names what it seals: another purpose gets another key.
 */
export function stateCipherKey(
  secret: string,
  info = 'church-hub-sync-state-v1'
): Promise<CryptoKey> {
  const cacheKey = `${info}\n${secret}`
  let key = keys.get(cacheKey)
  if (!key) {
    key = (async () => {
      const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        'HKDF',
        false,
        ['deriveKey']
      )
      return crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(),
          info: new TextEncoder().encode(info),
        },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    })()
    keys.set(cacheKey, key)
  }
  return key
}
