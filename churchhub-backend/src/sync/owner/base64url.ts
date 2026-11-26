/** Bytes as base64url (no padding), and back. */
export function bytesToBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function base64urlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

/** UTF-8 text as base64url, and back. */
export function toBase64url(text: string): string {
  return bytesToBase64url(new TextEncoder().encode(text))
}

export function fromBase64url(value: string): string {
  return new TextDecoder().decode(base64urlToBytes(value))
}
