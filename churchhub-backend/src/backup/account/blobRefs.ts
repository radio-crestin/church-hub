import type { AccountRecord } from './AccountRecord'

/**
 * Takes one ref on each blob for a backup or upload; blobs the account
 * doesn't have yet are added as not stored, with their declared size.
 */
export function takeBlobRefs(
  record: AccountRecord,
  hashes: string[],
  sizes: Map<string, number>
): void {
  for (const hash of hashes) {
    const entry = record.blobs[hash]
    if (entry) entry.refs += 1
    else record.blobs[hash] = { sizeBytes: sizes.get(hash) ?? 0, refs: 1, stored: false }
  }
}

/**
 * Releases one ref on each blob. Blobs left with none are dropped from the
 * record (their stored bytes freed from the usage) and returned, so the
 * caller deletes their objects.
 */
export function releaseBlobRefs(record: AccountRecord, hashes: string[]): string[] {
  const unreferenced: string[] = []
  for (const hash of hashes) {
    const entry = record.blobs[hash]
    if (!entry) continue
    entry.refs -= 1
    if (entry.refs > 0) continue
    if (entry.stored) record.usedBytes -= entry.sizeBytes
    delete record.blobs[hash]
    unreferenced.push(hash)
  }
  record.usedBytes = Math.max(0, record.usedBytes)
  return unreferenced
}
