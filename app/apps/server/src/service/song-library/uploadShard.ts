import { getLibraryServiceUrl } from './getLibraryServiceUrl'
import { CURATED_SOURCE_ID } from './types'
import { getInstallation } from '../sync/cloud/getInstallation'

/** Uploads one gzipped shard of the curated library (content-addressed). */
export async function uploadShard(
  ticket: string,
  hash: string,
  bytes: Uint8Array,
): Promise<void> {
  const base = (await getLibraryServiceUrl()).replace(/\/+$/, '')
  const response = await fetch(
    `${base}/sync/libraries/${CURATED_SOURCE_ID}/shards/${hash}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/gzip',
        Authorization: `Bearer ${ticket}`,
        'X-Church-Hub-Installation': getInstallation().id,
      },
      body: new Blob([bytes as BlobPart]),
      signal: AbortSignal.timeout(60_000),
    },
  )
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      code?: string
      error?: string
    }
    throw new Error(
      `Sync service ${response.status}${body.code ? ` ${body.code}` : ''}: ${body.error ?? 'shard upload failed'}`,
    )
  }
}
