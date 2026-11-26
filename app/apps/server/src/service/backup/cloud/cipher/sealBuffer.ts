import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { createDecryptStream } from './createDecryptStream'
import { createEncryptStream } from './createEncryptStream'

async function collect(source: Buffer, transform: NodeJS.ReadWriteStream) {
  const chunks: Buffer[] = []
  await pipeline(Readable.from([source]), transform, async (stream) => {
    for await (const chunk of stream) chunks.push(chunk as Buffer)
  })
  return Buffer.concat(chunks)
}

/** A small buffer (the manifest) in the `.chb` format. */
export const sealBuffer = (key: Buffer, keyVersion: number, plain: Buffer) =>
  collect(plain, createEncryptStream(key, keyVersion))

/** The buffer back; `backup_unreadable` when changed or the key is wrong. */
export const openBuffer = (key: Buffer, keyVersion: number, sealed: Buffer) =>
  collect(sealed, createDecryptStream(key, keyVersion))
