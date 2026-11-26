import { gunzipSync, gzipSync } from 'node:zlib'

import { openBuffer, sealBuffer } from './cipher/sealBuffer'

/**
 * What a cloud backup is made of, encrypted (the service never reads it):
 * the user part's hash and size, and every resource blob it needs, by hash.
 */
export interface BackupManifest {
  format: 'church-hub-cloud-backup'
  version: 1
  createdAt: number
  appVersion: string
  userPart: { sha256: string; sizeBytes: number }
  blobs: { hash: string; sizeBytes: number; label: string }[]
}

export const sealManifest = (
  key: Buffer,
  keyVersion: number,
  manifest: BackupManifest,
) =>
  sealBuffer(key, keyVersion, gzipSync(Buffer.from(JSON.stringify(manifest))))

/** The manifest back, checked; `backup_unreadable` otherwise. */
export async function openManifest(
  key: Buffer,
  keyVersion: number,
  sealed: Buffer,
): Promise<BackupManifest> {
  const manifest = JSON.parse(
    gunzipSync(await openBuffer(key, keyVersion, sealed)).toString('utf8'),
  ) as BackupManifest
  if (manifest.format !== 'church-hub-cloud-backup' || manifest.version !== 1) {
    throw new Error('backup_unreadable')
  }
  return manifest
}
