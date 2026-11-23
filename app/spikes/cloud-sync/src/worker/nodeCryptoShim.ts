// biome-ignore-all lint/correctness/noUndeclaredDependencies: the spike sits outside the workspaces and uses app/node_modules
/**
 * The synchronous `node:crypto` calls the server's migrations make
 * (randomBytes, createHash('sha256'), scryptSync), in the browser. WebCrypto's
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

export default { randomBytes, createHash, scryptSync, randomUUID }
