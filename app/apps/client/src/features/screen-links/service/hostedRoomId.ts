const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** A new host key: 256 random bits, base64url (as the PC's, hostedRoom.ts). */
export const newHostKey = () =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(32)))

/**
 * The room a host key opens on the relay: "h1" + SHA-256 of the key, the
 * same as the PC's (server signaling/hostedRoom.ts). Only the key's holder
 * may host it; devices only ever hold the room id.
 */
export async function hostedRoomId(hostKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(hostKey),
  )
  return `h1${toBase64Url(new Uint8Array(digest))}`
}
