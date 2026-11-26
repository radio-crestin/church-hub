import { gzipJson } from '../gzipJson'
import type { ChurchState } from './ChurchState'
import { stateCipherKey } from './stateCipherKey'

/** The random IV every sealed state starts with. */
export const IV_BYTES = 12

/**
 * The state, gzipped then sealed with AES-256-GCM: a random IV, then the
 * ciphertext. The church id is bound as associated data, so one church's
 * state can't be passed off as another's. Without SYNC_SECRET it is
 * unreadable, even from a public bucket.
 */
export async function encryptState(
  state: ChurchState,
  secret: string
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const sealed = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: new TextEncoder().encode(state.id),
    },
    await stateCipherKey(secret),
    await gzipJson(state)
  )
  const bytes = new Uint8Array(IV_BYTES + sealed.byteLength)
  bytes.set(iv)
  bytes.set(new Uint8Array(sealed), IV_BYTES)
  return bytes
}
