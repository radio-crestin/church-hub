import { base64urlToBytes, bytesToBase64url } from '../../sync/owner/base64url'
import { stateCipherKey } from '../../sync/state/stateCipherKey'

const IV_BYTES = 12

/**
 * Seals a sign-in's state with AES-256-GCM under a key derived from the
 * secret for `purpose`: Google and the browser see only ciphertext, so the
 * PKCE verifier stays secret and nothing in it can be swapped. No cookie or
 * database is needed to carry it through Google.
 */
export async function sealState(
  state: object,
  secret: string,
  purpose: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await stateCipherKey(secret, purpose),
    new TextEncoder().encode(JSON.stringify(state))
  )
  const bytes = new Uint8Array(IV_BYTES + sealed.byteLength)
  bytes.set(iv)
  bytes.set(new Uint8Array(sealed), IV_BYTES)
  return bytesToBase64url(bytes)
}

/** The state back, or null when it was tampered with or sealed for another purpose. */
export async function openState<T>(
  value: string,
  secret: string,
  purpose: string
): Promise<T | null> {
  try {
    const bytes = base64urlToBytes(value)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
      await stateCipherKey(secret, purpose),
      bytes.slice(IV_BYTES)
    )
    return JSON.parse(new TextDecoder().decode(plain)) as T
  } catch {
    return null
  }
}
