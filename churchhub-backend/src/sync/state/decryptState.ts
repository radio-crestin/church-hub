import { gunzipJson } from '../gzipJson'
import type { ChurchState } from './ChurchState'
import { IV_BYTES } from './encryptState'
import { stateCipherKey } from './stateCipherKey'

/** The reverse of encryptState; throws if the bytes were tampered with. */
export async function decryptState(
  bytes: ArrayBuffer,
  churchId: string,
  secret: string
): Promise<ChurchState> {
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(bytes, 0, IV_BYTES),
      additionalData: new TextEncoder().encode(churchId),
    },
    await stateCipherKey(secret),
    new Uint8Array(bytes, IV_BYTES)
  )
  return gunzipJson<ChurchState>(plain)
}
