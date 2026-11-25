import { AwsClient } from 'aws4fetch'
import { SyncError } from './SyncError'
import type { Bindings } from '../types'

export interface PutOptions {
  contentType: string
  cacheControl: string
}

/** The sync bucket, written only by this service; anyone reads by path. */
export interface Bucket {
  put(key: string, body: Uint8Array, options: PutOptions): Promise<void>
  /** The object's bytes, or null when it doesn't exist. */
  get(key: string): Promise<ArrayBuffer | null>
  delete(key: string): Promise<void>
  /** Where readers GET `key` from, without credentials. */
  publicUrl(key: string): string
}

/**
 * Any S3-compatible bucket (R2, B2, AWS S3, MinIO, SeaweedFS, Garage…),
 * path-style and signed with SigV4, from the S3_* settings.
 */
export function createBucket(env: Bindings): Bucket {
  const {
    S3_ENDPOINT,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_PUBLIC_URL,
  } = env
  if (
    !S3_ENDPOINT ||
    !S3_BUCKET ||
    !S3_ACCESS_KEY_ID ||
    !S3_SECRET_ACCESS_KEY ||
    !S3_PUBLIC_URL
  ) {
    throw new SyncError(503, 'not_configured', 'Cloud sync storage is not configured')
  }
  const client = new AwsClient({
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    service: 's3',
    region: env.S3_REGION || 'auto',
  })
  const base = `${S3_ENDPOINT.replace(/\/+$/, '')}/${S3_BUCKET}`
  const objectUrl = (key: string) =>
    `${base}/${key.split('/').map(encodeURIComponent).join('/')}`

  const send = async (key: string, init: RequestInit): Promise<Response> => {
    const response = await client.fetch(objectUrl(key), init)
    if (response.ok || response.status === 404) return response
    const detail = await response.text().catch(() => '')
    throw new Error(
      `S3 ${init.method} ${key} failed: ${response.status} ${detail.slice(0, 200)}`
    )
  }

  return {
    async put(key, body, options) {
      await send(key, {
        method: 'PUT',
        body,
        headers: {
          'Content-Type': options.contentType,
          'Cache-Control': options.cacheControl,
        },
      })
    },
    async get(key) {
      const response = await send(key, { method: 'GET' })
      return response.status === 404 ? null : response.arrayBuffer()
    },
    async delete(key) {
      await send(key, { method: 'DELETE' })
    },
    publicUrl(key) {
      return `${S3_PUBLIC_URL.replace(/\/+$/, '')}/${key}`
    },
  }
}
