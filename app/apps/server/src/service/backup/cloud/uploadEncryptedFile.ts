import { CloudBackupError } from './CloudBackupError'
import type { CloudBackupFile } from './CloudBackupFile'
import { cloudBackupRequest } from './cloudBackupRequest'

/** Part URLs asked for at a time, so none expires before its turn. */
const PARTS_PER_BATCH = 8
const PART_ATTEMPTS = 3
const PART_TIMEOUT_MS = 10 * 60 * 1000

interface StartedUpload {
  backupId: string
  partSize: number
  partCount: number
}

/** PUTs one part to its presigned URL, retrying a failed attempt. */
async function putPart(url: string, body: Blob): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      method: 'PUT',
      body,
      signal: AbortSignal.timeout(PART_TIMEOUT_MS),
    }).catch(() => null)
    if (response?.ok) return
    if (attempt >= PART_ATTEMPTS) throw new CloudBackupError('upload_failed')
  }
}

/**
 * Uploads an encrypted backup file: the service checks the free tier and
 * hands out presigned part URLs in batches; the parts go straight to the
 * bucket. A failed upload is cancelled, so its reserved space is freed.
 */
export async function uploadEncryptedFile(
  path: string,
  sizeBytes: number,
  appVersion: string,
  keyVersion: number,
): Promise<CloudBackupFile> {
  const upload = await cloudBackupRequest<StartedUpload>(
    'POST',
    '/backup/uploads',
    {
      sizeBytes,
      appVersion,
      keyVersion,
    },
  )
  const base = `/backup/uploads/${encodeURIComponent(upload.backupId)}`
  try {
    const file = Bun.file(path)
    for (let first = 1; first <= upload.partCount; first += PARTS_PER_BATCH) {
      const partNumbers = Array.from(
        { length: Math.min(PARTS_PER_BATCH, upload.partCount - first + 1) },
        (_, i) => first + i,
      )
      const { parts } = await cloudBackupRequest<{
        parts: { partNumber: number; url: string }[]
      }>('POST', `${base}/parts`, { partNumbers })
      for (const part of parts) {
        const start = (part.partNumber - 1) * upload.partSize
        await putPart(part.url, file.slice(start, start + upload.partSize))
      }
    }
    const { backup } = await cloudBackupRequest<{ backup: CloudBackupFile }>(
      'POST',
      `${base}/complete`,
    )
    return backup
  } catch (error) {
    await cloudBackupRequest('DELETE', base).catch(() => {})
    throw error
  }
}
