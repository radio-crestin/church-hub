/**
 * The id of the room a host key opens: "h1" + base64url(SHA-256(key)). The
 * id is public (it is in the listener link); the key it comes from is not.
 */
export async function hostedRoomId(hostKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(hostKey)
  )
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
  return `h1${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}
