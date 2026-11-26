/**
 * An encrypted cloud backup (`.chb`): a fixed header, then the gzipped
 * database in AES-256-GCM chunks under a random key made for this backup.
 *
 *   header  "CHBACKUP" | format u8 | keyVersion u8 | chunkSize u32be
 *           | wrapIv (12) | wrapped data key (32 + 16-byte tag)
 *   chunk   iv (12) | ciphertext (≤ chunkSize) | tag (16)
 *
 * The data key is wrapped (AES-256-GCM) with the account key, with the
 * header's first 14 bytes as its additional data. Each chunk's additional
 * data is the whole header, its index (u32be) and whether it is the last
 * (u8), so chunks can't be reordered, dropped, or the file cut short.
 */
export const MAGIC = Buffer.from('CHBACKUP', 'ascii')
export const FORMAT_VERSION = 1
export const CHUNK_SIZE = 1024 * 1024
export const IV_BYTES = 12
export const TAG_BYTES = 16
export const KEY_BYTES = 32
/** magic + format + keyVersion + chunkSize: what the wrapped key is bound to. */
export const PREAMBLE_BYTES = MAGIC.length + 1 + 1 + 4
export const HEADER_BYTES = PREAMBLE_BYTES + IV_BYTES + KEY_BYTES + TAG_BYTES

/** A chunk's additional data: the header, its index and the last flag. */
export function chunkAad(header: Buffer, index: number, last: boolean): Buffer {
  const suffix = Buffer.alloc(5)
  suffix.writeUInt32BE(index, 0)
  suffix.writeUInt8(last ? 1 : 0, 4)
  return Buffer.concat([header, suffix])
}
