import { bytesToBase64url } from './owner/base64url'

/** A random base64url id of `bytes` bytes (32 = 256 bits, the path secret). */
export function randomId(bytes: number): string {
  return bytesToBase64url(crypto.getRandomValues(new Uint8Array(bytes)))
}
