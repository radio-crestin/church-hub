import { Readable } from 'node:stream'
import type { drive_v3 } from 'googleapis'

import {
  APP_DATA_FOLDER,
  LIBRARY_FILE_NAME,
  LIBRARY_MIME_TYPE,
  LIBRARY_SCHEMA_VERSION,
} from './constants'
import type { LibraryFile } from './types'
import { createLogger } from '../../utils/logger'

const logger = createLogger('sync')

export interface RemoteLibraryRef {
  fileId: string
  /** Drive's monotonically increasing file version. */
  version: string
}

/**
 * Finds the shared library file in the appDataFolder, returning null when no
 * device has synced yet.
 */
export async function findLibraryFile(
  drive: drive_v3.Drive,
): Promise<RemoteLibraryRef | null> {
  const res = await drive.files.list({
    spaces: APP_DATA_FOLDER,
    q: `name = '${LIBRARY_FILE_NAME}'`,
    pageSize: 1,
    fields: 'files(id, version)',
  })
  const file = res.data.files?.[0]
  if (!file?.id) return null
  return { fileId: file.id, version: String(file.version ?? '') }
}

/** Downloads and parses the shared library file. */
export async function downloadLibrary(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<LibraryFile> {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  )
  const compressed = new Uint8Array(res.data as ArrayBuffer)
  const json = new TextDecoder().decode(Bun.gunzipSync(compressed))
  return JSON.parse(json) as LibraryFile
}

/**
 * Uploads the merged library, updating the existing file in place when its id
 * is known (keeping a single shared file) or creating it on first sync.
 */
export async function uploadLibrary(
  drive: drive_v3.Drive,
  library: LibraryFile,
  existingFileId: string | null,
): Promise<RemoteLibraryRef> {
  const body = Bun.gzipSync(new TextEncoder().encode(JSON.stringify(library)))
  const media = {
    mimeType: LIBRARY_MIME_TYPE,
    body: Readable.from(Buffer.from(body)),
  }
  const appProperties = {
    schemaVersion: String(LIBRARY_SCHEMA_VERSION),
    updatedByDevice: library.updatedByDevice,
  }

  if (existingFileId) {
    try {
      const res = await drive.files.update({
        fileId: existingFileId,
        requestBody: { appProperties },
        media,
        fields: 'id, version',
      })
      return {
        fileId: res.data.id ?? existingFileId,
        version: String(res.data.version ?? ''),
      }
    } catch (error) {
      const status = (error as { code?: number }).code
      // The file may have been deleted from another device — recreate it.
      if (status !== 404) throw error
      logger.warning('Library file vanished from Drive, recreating it')
    }
  }

  const res = await drive.files.create({
    requestBody: {
      name: LIBRARY_FILE_NAME,
      parents: [APP_DATA_FOLDER],
      appProperties,
    },
    media,
    fields: 'id, version',
  })
  if (!res.data.id) throw new Error('Drive did not return a file id')
  return { fileId: res.data.id, version: String(res.data.version ?? '') }
}
