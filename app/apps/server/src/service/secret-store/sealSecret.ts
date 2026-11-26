import { createCipheriv, randomBytes } from 'node:crypto'

import { associatedData } from './associatedData'
import { activeKey } from './keyRing'
import { formatSealed } from './sealedFormat'
import type { SecretPlace } from './secretPlace'

/**
 * Seals a secret for storage at `place` with the active data key
 * (AES-256-GCM, a fresh random nonce). An empty value stays empty: it
 * means "not set". Throws while the data key can't be opened.
 */
export function sealSecret(plain: string, place: SecretPlace): string {
  if (plain === '') return ''
  const { id, key } = activeKey()
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(associatedData(place))
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ])
  return formatSealed({ keyId: id, nonce, ciphertext })
}
