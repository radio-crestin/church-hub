/**
 * `node:crypto` in the browser build: the synchronous calls the server makes
 * (randomBytes, createHash('sha256'), scryptSync, randomUUID); ciphers
 * stay the PC's. WebCrypto's
 * digest and derive are async, so the sync ones come from @noble/hashes.
 */
import { scrypt } from '@noble/hashes/scrypt'
import { sha256 } from '@noble/hashes/sha2'

class Bytes extends Uint8Array {
  override toString(encoding?: string): string {
    if (encoding === 'hex') {
      return [...this]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
    }
    if (encoding === 'base64') return btoa(String.fromCharCode(...this))
    if (encoding === 'base64url') {
      return this.toString('base64')
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '')
    }
    return new TextDecoder().decode(this)
  }
}

const toBytes = (value: string | Uint8Array) =>
  typeof value === 'string' ? new TextEncoder().encode(value) : value

export function randomBytes(size: number): Bytes {
  return crypto.getRandomValues(new Bytes(size))
}

export function createHash(algorithm: string) {
  if (algorithm !== 'sha256')
    throw new Error(`createHash(${algorithm}) not shimmed`)
  const hash = sha256.create()
  const api = {
    update(value: string | Uint8Array) {
      hash.update(toBytes(value))
      return api
    },
    digest(encoding?: string) {
      const bytes = new Bytes(hash.digest())
      return encoding ? bytes.toString(encoding) : bytes
    },
  }
  return api
}

export function scryptSync(
  password: string | Uint8Array,
  salt: string | Uint8Array,
  keylen: number,
): Bytes {
  return new Bytes(
    scrypt(toBytes(password), toBytes(salt), {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: keylen,
    }),
  )
}

export function randomUUID(): string {
  return crypto.randomUUID()
}

/**
 * Ciphers seal secrets at rest and Cloud backups, both the PC's own (the
 * browser keeps secrets as they are: sealSecret.ts).
 */
const needsChurchPc = (name: string) => () => {
  throw new Error(`${name} needs the church PC`)
}
export const createCipheriv = needsChurchPc('createCipheriv')
export const createDecipheriv = needsChurchPc('createDecipheriv')

export default {
  randomBytes,
  createHash,
  scryptSync,
  randomUUID,
  createCipheriv,
  createDecipheriv,
}
