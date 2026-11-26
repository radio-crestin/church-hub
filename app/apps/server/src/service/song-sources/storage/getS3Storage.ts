import type { S3Storage } from './types'
import { getRawDatabase } from '../../../db'
import { openSecret, secretPlaces } from '../../secret-store'

interface StorageRow {
  endpoint: string
  region: string | null
  bucket: string
  path_prefix: string
  access_key_id: string
  secret_access_key: string
  public_base_url: string
}

/**
 * The configured S3 storage, its secret key opened, or null when the user
 * has not set one up.
 */
export function getS3Storage(): S3Storage | null {
  const row = getRawDatabase()
    .query<StorageRow, []>(
      `SELECT endpoint, region, bucket, path_prefix, access_key_id,
              secret_access_key, public_base_url
         FROM song_source_storage WHERE id = 1`,
    )
    .get()
  if (!row) return null
  return {
    endpoint: row.endpoint,
    region: row.region,
    bucket: row.bucket,
    pathPrefix: row.path_prefix,
    accessKeyId: row.access_key_id,
    // Unopenable (another computer's): asked for again, like a missing one.
    secretAccessKey:
      openSecret(row.secret_access_key, secretPlaces.s3SecretAccessKey) ?? '',
    publicBaseUrl: row.public_base_url,
  }
}
