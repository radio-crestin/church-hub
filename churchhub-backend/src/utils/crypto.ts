import type { OAuthState } from '../types'

/**
 * Derives an AES-256 encryption key from a hex-encoded secret.
 */
async function getEncryptionKey(hexSecret: string): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(
    hexSecret.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  )

  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

/**
 * Encrypts OAuth state to a base64 string using AES-256-GCM.
 * The IV is prepended to the ciphertext.
 */
export async function encryptState(
  state: OAuthState,
  hexSecret: string
): Promise<string> {
  const key = await getEncryptionKey(hexSecret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(state))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  )

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)

  // Base64 encode
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypts a base64 string back to OAuth state.
 * Returns null if decryption fails (tampered or invalid data).
 */
export async function decryptState(
  encryptedBase64: string,
  hexSecret: string
): Promise<OAuthState | null> {
  try {
    const key = await getEncryptionKey(hexSecret)

    // Base64 decode
    const combined = Uint8Array.from(atob(encryptedBase64), (c) =>
      c.charCodeAt(0)
    )

    // Extract IV and ciphertext
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )

    const json = new TextDecoder().decode(plaintext)
    return JSON.parse(json) as OAuthState
  } catch {
    return null
  }
}
