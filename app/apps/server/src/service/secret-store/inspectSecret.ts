import { createDecipheriv } from 'node:crypto'

import { associatedData } from './associatedData'
import { knownKey } from './keyRing'
import { isSealed, parseSealed, type SealedValue } from './sealedFormat'
import type { SecretPlace } from './secretPlace'

const TAG_LENGTH = 16

export type SecretInspection =
  | { state: 'empty' }
  /** Stored before secrets were sealed (or by a bug): not yet sealed. */
  | { state: 'plain'; value: string }
  | { state: 'open'; value: string; keyId: string }
  /** Sealed with a key this server doesn't hold (yet). */
  | { state: 'no-key'; keyId: string }
  /** Malformed, or it fails its tag: altered, or moved from another place. */
  | { state: 'broken' }

function decrypt(
  { nonce, ciphertext }: SealedValue,
  key: Buffer,
  place: SecretPlace,
): string | null {
  if (ciphertext.length < TAG_LENGTH) return null
  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAAD(associatedData(place))
  decipher.setAuthTag(ciphertext.subarray(-TAG_LENGTH))
  try {
    return Buffer.concat([
      decipher.update(ciphertext.subarray(0, -TAG_LENGTH)),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    // GCM reports a wrong tag only by throwing: the caller logs 'broken'.
    return null
  }
}

/** What a stored value is, and its secret when this server can open it. */
export function inspectSecret(
  stored: string,
  place: SecretPlace,
): SecretInspection {
  if (stored === '') return { state: 'empty' }
  if (!isSealed(stored)) return { state: 'plain', value: stored }
  const sealed = parseSealed(stored)
  if (!sealed) return { state: 'broken' }
  const key = knownKey(sealed.keyId)
  if (!key) return { state: 'no-key', keyId: sealed.keyId }
  const value = decrypt(sealed, key, place)
  return value === null
    ? { state: 'broken' }
    : { state: 'open', value, keyId: sealed.keyId }
}
