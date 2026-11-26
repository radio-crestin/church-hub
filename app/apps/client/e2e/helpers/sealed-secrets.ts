import { createDecipheriv } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Opens what the server sealed (service/secret-store), written apart from
 * its code so a spec checks the stored format itself: `enc:v1:<key id>:
 * <nonce>:<ciphertext + tag>`, AES-256-GCM, the place as associated data.
 * The suite's servers keep their key in secret-key.json next to app.db.
 */
export const SEALED = /^enc:v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/

export function readDataKey(databasePath: string): { id: string; key: Buffer } {
  const file = JSON.parse(
    readFileSync(join(dirname(databasePath), 'secret-key.json'), 'utf8'),
  ) as { id: string; store: string; key: string }
  if (file.store !== 'file') throw new Error('the key is not in the file')
  return { id: file.id, key: Buffer.from(file.key, 'base64') }
}

/**
 * The secret in `stored`, sealed at `place` (`table.column` or
 * `table.column:row`) by the server whose database is at `databasePath`.
 */
export function openSealed(
  databasePath: string,
  stored: string,
  place: string,
): string {
  const [, , keyId, nonce, sealed] = stored.split(':')
  const { id, key } = readDataKey(databasePath)
  if (keyId !== id) throw new Error(`sealed with key ${keyId}, not ${id}`)
  const ciphertext = Buffer.from(sealed ?? '', 'base64url')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(nonce ?? '', 'base64url'),
  )
  decipher.setAAD(Buffer.from(`church-hub:v1:${place}`))
  decipher.setAuthTag(ciphertext.subarray(-16))
  return Buffer.concat([
    decipher.update(ciphertext.subarray(0, -16)),
    decipher.final(),
  ]).toString('utf8')
}
