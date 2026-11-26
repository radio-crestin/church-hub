/**
 * A sealed secret as stored: `enc:v1:<key id>:<nonce>:<ciphertext + tag>`,
 * the last two base64url. v1 is AES-256-GCM with a 12-byte random nonce per
 * value and a 16-byte tag, the place sealed in as associated data.
 */
const PREFIX = 'enc:v1:'

export interface SealedValue {
  keyId: string
  nonce: Buffer
  /** The ciphertext followed by the 16-byte authentication tag. */
  ciphertext: Buffer
}

export const isSealed = (stored: string) => stored.startsWith(PREFIX)

export const formatSealed = ({ keyId, nonce, ciphertext }: SealedValue) =>
  `${PREFIX}${keyId}:${nonce.toString('base64url')}:${ciphertext.toString('base64url')}`

/** The parts of a sealed value, or null when it is malformed. */
export function parseSealed(stored: string): SealedValue | null {
  if (!isSealed(stored)) return null
  const [keyId, nonce, ciphertext] = stored.slice(PREFIX.length).split(':')
  if (!keyId || !nonce || !ciphertext) return null
  return {
    keyId,
    nonce: Buffer.from(nonce, 'base64url'),
    ciphertext: Buffer.from(ciphertext, 'base64url'),
  }
}
