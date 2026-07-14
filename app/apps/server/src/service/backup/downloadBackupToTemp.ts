import { createWriteStream } from 'node:fs'
import type { Readable } from 'node:stream'
import type { drive_v3 } from 'googleapis'

/**
 * Streams a Drive backup file to a local temp path. Shared by restore and
 * inspect so both download the file the same way without buffering it in
 * memory. The caller owns the temp file and must delete it when done.
 */
export async function downloadBackupToTemp(
  drive: drive_v3.Drive,
  fileId: string,
  tempPath: string,
): Promise<void> {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' },
  )

  await new Promise<void>((resolve, reject) => {
    const dest = createWriteStream(tempPath)
    const stream = res.data as unknown as Readable
    stream
      .on('error', reject)
      .pipe(dest)
      .on('error', reject)
      .on('finish', () => resolve())
  })
}
