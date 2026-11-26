import { CloudBackupError } from './CloudBackupError'
import type { CloudBackupFile } from './CloudBackupFile'
import { cloudBackupRequest } from './cloudBackupRequest'
import type { ResourceBlob } from './resources/buildResourceBlobs'

/** URLs asked for at a time, so none expires before its turn. */
const BATCH = 8
const PUT_ATTEMPTS = 3
const PUT_TIMEOUT_MS = 10 * 60 * 1000

interface StartedUpload {
  backupId: string
  partSize: number
  partCount: number
  missingBlobs: string[]
}

/** PUTs a body to a presigned URL (signed for its exact length), retrying. */
async function put(url: string, body: Blob): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      method: 'PUT',
      body,
      signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
    }).catch(() => null)
    if (response?.ok) return
    if (attempt >= PUT_ATTEMPTS) throw new CloudBackupError('upload_failed')
  }
}

const batches = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / BATCH) }, (_, i) =>
    items.slice(i * BATCH, (i + 1) * BATCH),
  )

/**
 * Sends one backup: the service checks the quota and answers which blobs it
 * lacks; the user part goes up in parts, the manifest and those blobs as
 * whole files, each straight to the bucket through a presigned URL. A
 * failed upload is cancelled, so its reserved space is freed.
 */
export async function uploadBackupFiles(input: {
  userPath: string
  userBytes: number
  manifest: Buffer
  blobs: ResourceBlob[]
  appVersion: string
  keyVersion: number
}): Promise<CloudBackupFile> {
  const upload = await cloudBackupRequest<StartedUpload>(
    'POST',
    '/backup/uploads',
    {
      userBytes: input.userBytes,
      manifestBytes: input.manifest.length,
      blobs: input.blobs.map(({ hash, sizeBytes }) => ({ hash, sizeBytes })),
      appVersion: input.appVersion,
      keyVersion: input.keyVersion,
    },
  )
  const base = `/backup/uploads/${encodeURIComponent(upload.backupId)}`
  try {
    const user = Bun.file(input.userPath)
    const partNumbers = Array.from(
      { length: upload.partCount },
      (_, i) => i + 1,
    )
    for (const batch of batches(partNumbers)) {
      const { parts } = await cloudBackupRequest<{
        parts: { partNumber: number; url: string }[]
      }>('POST', `${base}/parts`, { partNumbers: batch })
      for (const part of parts) {
        const start = (part.partNumber - 1) * upload.partSize
        await put(part.url, user.slice(start, start + upload.partSize))
      }
    }
    const pathOf = new Map(input.blobs.map((blob) => [blob.hash, blob.path]))
    for (const batch of batches(['manifest', ...upload.missingBlobs])) {
      const { files } = await cloudBackupRequest<{
        files: { name: string; url: string }[]
      }>('POST', `${base}/files`, { files: batch })
      for (const file of files) {
        const body =
          file.name === 'manifest'
            ? new Blob([new Uint8Array(input.manifest)])
            : Bun.file(pathOf.get(file.name) as string)
        await put(file.url, body)
      }
    }
    const backup = await cloudBackupRequest<CloudBackupFile>(
      'POST',
      `${base}/complete`,
    )
    return { ...backup, sentBlobs: upload.missingBlobs.length }
  } catch (error) {
    await cloudBackupRequest('DELETE', base).catch(() => {})
    throw error
  }
}
