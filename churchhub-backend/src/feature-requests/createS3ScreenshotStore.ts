import { AwsClient } from 'aws4fetch'
import type { Bindings } from '../types'
import type { ScreenshotStore } from './screenshotStore'

const PREFIX = 'feature-requests/'

/**
 * Screenshot store on any S3-compatible bucket (path-style, SigV4):
 * FEATURE_REQUEST_S3_BUCKET, else S3_STATE_BUCKET, else S3_BUCKET, under
 * `feature-requests/`, with the S3_* settings cloud sync uses. Objects are
 * read back through the service, so the bucket can stay private.
 */
export function createS3ScreenshotStore(env: Bindings): ScreenshotStore {
  const client = new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
    service: 's3',
    region: env.S3_REGION || 'auto',
  })
  const objectUrl = (id: string) =>
    `${bucketUrl(env)}/${PREFIX}${encodeURIComponent(id)}`

  return {
    async save(image) {
      const id = `${crypto.randomUUID()}.${image.extension}`
      const response = await client.fetch(objectUrl(id), {
        method: 'PUT',
        body: image.bytes,
        headers: { 'Content-Type': image.contentType },
      })
      if (!response.ok) throw await storageError('PUT', response)
      return id
    },
    async load(id) {
      const response = await client.fetch(objectUrl(id), { method: 'GET' })
      if (response.status === 404) return null
      if (!response.ok || !response.body) throw await storageError('GET', response)
      return {
        body: response.body,
        contentType: response.headers.get('Content-Type') ?? 'image/jpeg',
      }
    },
  }
}

function bucketUrl(env: Bindings): string {
  const name =
    env.FEATURE_REQUEST_S3_BUCKET || env.S3_STATE_BUCKET || env.S3_BUCKET
  const endpoint = env.S3_ENDPOINT?.replace(/\/+$/, '')
  if (!endpoint || !name) {
    throw new Error('Screenshot storage is not configured (S3_*)')
  }
  return `${endpoint}/${name}`
}

/** The status only: storage error bodies can echo object keys. */
async function storageError(method: string, response: Response) {
  await response.body?.cancel()
  return new Error(`Screenshot storage ${method} failed: ${response.status}`)
}
