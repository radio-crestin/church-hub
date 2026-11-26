import { createDecipheriv } from 'node:crypto'
import { Transform } from 'node:stream'

import {
  chunkAad,
  FORMAT_VERSION,
  HEADER_BYTES,
  IV_BYTES,
  MAGIC,
  PREAMBLE_BYTES,
  TAG_BYTES,
} from './backupFileFormat'

function open(key: Buffer, sealed: Buffer, aad: Buffer): Buffer {
  const iv = sealed.subarray(0, IV_BYTES)
  const tag = sealed.subarray(sealed.length - TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(sealed.subarray(IV_BYTES, sealed.length - TAG_BYTES)),
    decipher.final(),
  ])
}

/** The data key and chunk size of a `.chb` header; throws when unreadable. */
function readHeader(header: Buffer, accountKey: Buffer, keyVersion: number) {
  if (
    !header.subarray(0, MAGIC.length).equals(MAGIC) ||
    header.readUInt8(MAGIC.length) !== FORMAT_VERSION ||
    header.readUInt8(MAGIC.length + 1) !== keyVersion
  ) {
    throw new Error('backup_unreadable')
  }
  const preamble = header.subarray(0, PREAMBLE_BYTES)
  return {
    dataKey: open(accountKey, header.subarray(PREAMBLE_BYTES), preamble),
    chunkSize: header.readUInt32BE(MAGIC.length + 2),
  }
}

/**
 * Decrypts a `.chb` stream (backupFileFormat) with the account key. Any
 * change to the file, a missing or reordered chunk, a cut-off end or the
 * wrong key fails with `backup_unreadable`.
 */
export function createDecryptStream(
  accountKey: Buffer,
  keyVersion: number,
): Transform {
  let pending: Buffer = Buffer.alloc(0)
  let header: Buffer | null = null
  let dataKey: Buffer = Buffer.alloc(0)
  let recordSize = 0
  let index = 0

  const guard = (work: () => void, done: (error?: Error) => void) => {
    try {
      work()
      done()
    } catch {
      done(new Error('backup_unreadable'))
    }
  }

  return new Transform({
    transform(chunk: Buffer, _encoding, done) {
      guard(() => {
        pending = Buffer.concat([pending, chunk])
        if (!header) {
          if (pending.length < HEADER_BYTES) return
          header = Buffer.from(pending.subarray(0, HEADER_BYTES))
          const read = readHeader(header, accountKey, keyVersion)
          dataKey = read.dataKey
          recordSize = IV_BYTES + read.chunkSize + TAG_BYTES
          pending = pending.subarray(HEADER_BYTES)
        }
        // Keep the last record back until the end: only it is marked last.
        while (pending.length > recordSize) {
          const record = pending.subarray(0, recordSize)
          this.push(open(dataKey, record, chunkAad(header, index++, false)))
          pending = pending.subarray(recordSize)
        }
      }, done)
    },
    flush(done) {
      guard(() => {
        if (!header || pending.length < IV_BYTES + TAG_BYTES) {
          throw new Error('backup_unreadable')
        }
        this.push(open(dataKey, pending, chunkAad(header, index, true)))
      }, done)
    },
  })
}
