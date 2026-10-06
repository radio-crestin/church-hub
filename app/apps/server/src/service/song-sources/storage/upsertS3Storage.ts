import { getS3Storage } from './getS3Storage'
import type { S3Storage, S3StorageInput } from './types'
import { getRawDatabase } from '../../../db'

const trimSlashes = (value: string) => value.trim().replace(/^\/+|\/+$/g, '')

/** Throws when a URL is not http(s); the message names the field. */
function requireHttpUrl(value: string, field: string): string {
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${field} must be an http(s) URL`)
  }
  return url.toString().replace(/\/+$/, '')
}

/**
 * Saves the S3 storage. A missing secret keeps the stored one, so the form
 * never has to show it again.
 */
export function upsertS3Storage(input: S3StorageInput): S3Storage {
  const secretAccessKey =
    input.secretAccessKey?.trim() || getS3Storage()?.secretAccessKey
  if (!secretAccessKey) throw new Error('The secret access key is required')
  if (!input.bucket.trim() || !input.accessKeyId.trim()) {
    throw new Error('The bucket and the access key are required')
  }

  const storage: S3Storage = {
    endpoint: requireHttpUrl(input.endpoint, 'Endpoint'),
    region: input.region?.trim() || null,
    bucket: input.bucket.trim(),
    pathPrefix: trimSlashes(input.pathPrefix ?? ''),
    accessKeyId: input.accessKeyId.trim(),
    secretAccessKey,
    publicBaseUrl: requireHttpUrl(input.publicBaseUrl, 'Public URL'),
  }

  getRawDatabase()
    .query(
      `INSERT INTO song_source_storage (id, endpoint, region, bucket,
         path_prefix, access_key_id, secret_access_key, public_base_url)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET endpoint = excluded.endpoint,
         region = excluded.region, bucket = excluded.bucket,
         path_prefix = excluded.path_prefix,
         access_key_id = excluded.access_key_id,
         secret_access_key = excluded.secret_access_key,
         public_base_url = excluded.public_base_url,
         updated_at = unixepoch()`,
    )
    .run(
      storage.endpoint,
      storage.region,
      storage.bucket,
      storage.pathPrefix,
      storage.accessKeyId,
      storage.secretAccessKey,
      storage.publicBaseUrl,
    )
  return storage
}
