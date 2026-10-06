import { S3Client } from 'bun'

import type { S3Storage } from './types'

/** Joins path parts with single slashes, dropping empty ones. */
export function joinKey(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
}

/**
 * The bucket, addressed by keys relative to a folder under the storage's
 * path prefix, plus that folder's public URL.
 */
export function openBucket(storage: S3Storage, folder: string) {
  const client = new S3Client({
    endpoint: storage.endpoint,
    region: storage.region ?? undefined,
    bucket: storage.bucket,
    accessKeyId: storage.accessKeyId,
    secretAccessKey: storage.secretAccessKey,
  })
  const keyFor = (path: string) => joinKey(storage.pathPrefix, folder, path)

  return {
    write: (path: string, contents: string) =>
      client.write(keyFor(path), contents, { type: 'application/json' }),
    delete: (path: string) => client.delete(keyFor(path)),
    publicUrl: (path: string) =>
      `${storage.publicBaseUrl}/${keyFor(path)
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
  }
}
