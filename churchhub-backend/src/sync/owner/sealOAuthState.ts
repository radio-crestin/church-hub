import { stateCipherKey } from '../state/stateCipherKey'
import { base64urlToBytes, bytesToBase64url } from './base64url'

const INFO = 'church-hub-owner-oauth-v1'
const IV_BYTES = 12

/** What the owner sign-in carries through Google, in its `state` parameter. */
export interface OwnerOAuthState {
  codeVerifier: string
  /** The PC's local callback the ticket goes to. */
  returnUrl: string
  /** The PC's own nonce, handed back so it accepts only its own sign-in. */
  nonce: string
  createdAt: number
}

/**
 * Seals the state with AES-GCM (a key derived from SYNC_SECRET): Google and
 * the browser see only ciphertext, so the PKCE verifier stays secret and the
 * return address can't be swapped. No cookie is needed.
 */
export async function sealOAuthState(
  state: OwnerOAuthState,
  secret: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await stateCipherKey(secret, INFO),
    new TextEncoder().encode(JSON.stringify(state))
  )
  const bytes = new Uint8Array(IV_BYTES + sealed.byteLength)
  bytes.set(iv)
  bytes.set(new Uint8Array(sealed), IV_BYTES)
  return bytesToBase64url(bytes)
}

/** The state back, or null when it was tampered with. */
export async function openOAuthState(
  value: string,
  secret: string
): Promise<OwnerOAuthState | null> {
  try {
    const bytes = base64urlToBytes(value)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
      await stateCipherKey(secret, INFO),
      bytes.slice(IV_BYTES)
    )
    return JSON.parse(new TextDecoder().decode(plain)) as OwnerOAuthState
  } catch {
    return null
  }
}
