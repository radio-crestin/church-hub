/** A random base64url id of `bytes` bytes (32 = 256 bits, the path secret). */
export function randomId(bytes: number): string {
  const value = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
