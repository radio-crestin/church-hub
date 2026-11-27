import { toBase64Url } from './toBase64Url'

/** SHA-256 of a screen link's token, base64url: what is kept and synced. */
export async function hashScreenLinkToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return toBase64Url(new Uint8Array(digest))
}
