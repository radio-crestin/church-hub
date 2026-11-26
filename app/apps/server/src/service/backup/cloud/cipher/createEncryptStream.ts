import { createCipheriv, randomBytes } from 'node:crypto'
import { Transform } from 'node:stream'

import {
  CHUNK_SIZE,
  chunkAad,
  FORMAT_VERSION,
  IV_BYTES,
  KEY_BYTES,
  MAGIC,
} from './backupFileFormat'

function seal(key: Buffer, plain: Buffer, aad: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad)
  return Buffer.concat([
    iv,
    cipher.update(plain),
    cipher.final(),
    cipher.getAuthTag(),
  ])
}

/** The header: a fresh data key, wrapped with the account key. */
function makeHeader(accountKey: Buffer, keyVersion: number, dataKey: Buffer) {
  const preamble = Buffer.alloc(MAGIC.length + 6)
  MAGIC.copy(preamble)
  preamble.writeUInt8(FORMAT_VERSION, MAGIC.length)
  preamble.writeUInt8(keyVersion, MAGIC.length + 1)
  preamble.writeUInt32BE(CHUNK_SIZE, MAGIC.length + 2)
  return Buffer.concat([preamble, seal(accountKey, dataKey, preamble)])
}

/**
 * Encrypts a stream into the `.chb` format (backupFileFormat): a new
 * random data key for this backup, wrapped with the account key.
 */
export function createEncryptStream(
  accountKey: Buffer,
  keyVersion: number,
): Transform {
  const dataKey = randomBytes(KEY_BYTES)
  const header = makeHeader(accountKey, keyVersion, dataKey)
  let pending: Buffer = Buffer.alloc(0)
  let index = 0
  let started = false
  const startOnce = (stream: Transform) => {
    if (started) return
    started = true
    stream.push(header)
  }

  return new Transform({
    transform(chunk: Buffer, _encoding, done) {
      startOnce(this)
      pending = Buffer.concat([pending, chunk])
      // Keep at least one byte back: the last chunk is only known at the end.
      while (pending.length > CHUNK_SIZE) {
        const plain = pending.subarray(0, CHUNK_SIZE)
        this.push(seal(dataKey, plain, chunkAad(header, index++, false)))
        pending = pending.subarray(CHUNK_SIZE)
      }
      done()
    },
    flush(done) {
      startOnce(this)
      this.push(seal(dataKey, pending, chunkAad(header, index, true)))
      done()
    },
  })
}
