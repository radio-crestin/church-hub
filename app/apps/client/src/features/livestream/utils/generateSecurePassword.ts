const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
// Largest multiple of the alphabet size that fits in a byte: bytes at or above
// it are rejected, so every character is equally likely (no modulo bias).
const LIMIT = 256 - (256 % ALPHABET.length)

/** A password from the Web Crypto CSPRNG, for secrets like the OBS WebSocket's. */
export function generateSecurePassword(length = 20): string {
  let password = ''
  while (password.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < LIMIT) password += ALPHABET[byte % ALPHABET.length]
      if (password.length === length) break
    }
  }
  return password
}
