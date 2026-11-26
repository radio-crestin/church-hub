import { AwsClient } from 'aws4fetch'
import type { BackupBucketSettings } from '../backupSettings'

/** How long a presigned upload-part or download URL works. */
export const PRESIGN_TTL_SECONDS = 15 * 60

export interface UploadedPart {
  partNumber: number
  etag: string
  size: number
}

/** The private backup bucket: only this service holds its keys. */
export interface BackupBucket {
  /** The object and its ETag, or null when it doesn't exist. */
  get(key: string): Promise<{ text: string; etag: string } | null>
  /** The new ETag, or null when the condition failed (compare-and-swap). */
  put(
    key: string,
    body: string,
    condition: { ifMatch: string } | { ifNoneMatch: '*' }
  ): Promise<string | null>
  /** The object's size, or null when it doesn't exist. */
  size(key: string): Promise<number | null>
  list(prefix: string): Promise<string[]>
  delete(key: string): Promise<void>
  createMultipartUpload(key: string): Promise<string>
  presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number
  ): Promise<string>
  listParts(key: string, uploadId: string): Promise<UploadedPart[]>
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadedPart[]
  ): Promise<void>
  abortMultipartUpload(key: string, uploadId: string): Promise<void>
  presignDownload(key: string): Promise<string>
}

const CONDITION_FAILED = new Set([409, 412])

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const tag = (xml: string, name: string) =>
  xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]

/**
 * The private bucket the encrypted backups live in, on any S3-compatible
 * store with multipart uploads and conditional writes (R2, AWS S3, MinIO),
 * path-style and signed with SigV4. Errors carry only the operation, the
 * status and S3's error code: never an object key.
 */
export function createBackupBucket(settings: BackupBucketSettings): BackupBucket {
  const client = new AwsClient({
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    service: 's3',
    region: settings.region,
    // A few quick retries on 5xx, not aws4fetch's default ten with backoff.
    retries: 3,
  })
  const urlOf = (endpoint: string, key = '') => {
    const base = `${endpoint.replace(/\/+$/, '')}/${settings.bucket}`
    return key ? `${base}/${key.split('/').map(encodeURIComponent).join('/')}` : base
  }
  const objectUrl = (key: string, query: Record<string, string> = {}) => {
    const url = new URL(urlOf(settings.endpoint, key))
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value)
    }
    return url.toString()
  }

  const send = async (
    operation: string,
    url: string,
    init: RequestInit,
    allowed: (status: number) => boolean = () => false
  ): Promise<Response> => {
    const response = await client.fetch(url, init)
    if (response.ok || response.status === 404 || allowed(response.status)) {
      return response
    }
    const body = await response.text().catch(() => '')
    const code = body.match(/<Code>([A-Za-z0-9.]{1,64})<\/Code>/)?.[1] ?? 'unknown'
    throw new Error(`S3 ${operation} failed: ${response.status} ${code}`)
  }

  const presign = async (
    method: 'GET' | 'PUT',
    key: string,
    query: Record<string, string> = {}
  ) => {
    const url = new URL(urlOf(settings.presignEndpoint, key))
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value)
    }
    url.searchParams.set('X-Amz-Expires', String(PRESIGN_TTL_SECONDS))
    const signed = await client.sign(url.toString(), {
      method,
      aws: { signQuery: true },
    })
    return signed.url
  }

  return {
    async get(key) {
      const response = await send('GetObject', objectUrl(key), { method: 'GET' })
      if (response.status === 404) return null
      return {
        text: await response.text(),
        etag: response.headers.get('ETag') ?? '',
      }
    },
    async put(key, body, condition) {
      const response = await send(
        'PutObject',
        objectUrl(key),
        {
          method: 'PUT',
          body,
          headers: {
            'Content-Type': 'application/json',
            ...('ifMatch' in condition
              ? { 'If-Match': condition.ifMatch }
              : { 'If-None-Match': condition.ifNoneMatch }),
          },
        },
        (status) => CONDITION_FAILED.has(status)
      )
      if (CONDITION_FAILED.has(response.status)) return null
      return response.headers.get('ETag') ?? ''
    },
    async size(key) {
      const response = await send('HeadObject', objectUrl(key), { method: 'HEAD' })
      if (response.status === 404) return null
      return Number(response.headers.get('Content-Length') ?? 0)
    },
    async list(prefix) {
      const keys: string[] = []
      let token: string | undefined
      do {
        const query = new URLSearchParams({ 'list-type': '2', prefix })
        if (token) query.set('continuation-token', token)
        const response = await send(
          'ListObjectsV2',
          `${urlOf(settings.endpoint)}?${query}`,
          { method: 'GET' }
        )
        const xml = await response.text()
        for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) {
          keys.push(decodeXml(match[1]))
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
          ? decodeXml(tag(xml, 'NextContinuationToken') ?? '') || undefined
          : undefined
      } while (token)
      return keys
    },
    async delete(key) {
      await send('DeleteObject', objectUrl(key), { method: 'DELETE' })
    },
    async createMultipartUpload(key) {
      const response = await send(
        'CreateMultipartUpload',
        objectUrl(key, { uploads: '' }),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
        }
      )
      const uploadId = tag(await response.text(), 'UploadId')
      if (!uploadId) throw new Error('S3 CreateMultipartUpload failed: no UploadId')
      return decodeXml(uploadId)
    },
    presignUploadPart(key, uploadId, partNumber) {
      return presign('PUT', key, { partNumber: String(partNumber), uploadId })
    },
    async listParts(key, uploadId) {
      const response = await send('ListParts', objectUrl(key, { uploadId }), {
        method: 'GET',
      })
      if (response.status === 404) return []
      const xml = await response.text()
      return [...xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)].map(([, part]) => ({
        partNumber: Number(tag(part, 'PartNumber')),
        etag: decodeXml(tag(part, 'ETag') ?? ''),
        size: Number(tag(part, 'Size')),
      }))
    },
    async completeMultipartUpload(key, uploadId, parts) {
      const body = `<CompleteMultipartUpload>${parts
        .map(
          (part) =>
            `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escapeXml(part.etag)}</ETag></Part>`
        )
        .join('')}</CompleteMultipartUpload>`
      const response = await send(
        'CompleteMultipartUpload',
        objectUrl(key, { uploadId }),
        { method: 'POST', body, headers: { 'Content-Type': 'application/xml' } }
      )
      // S3 can answer 200 with an <Error> body when completing fails late.
      const xml = await response.text()
      if (response.status === 404 || /<Error>/.test(xml)) {
        const code = tag(xml, 'Code') ?? 'NoSuchUpload'
        throw new Error(`S3 CompleteMultipartUpload failed: ${code}`)
      }
    },
    async abortMultipartUpload(key, uploadId) {
      await send('AbortMultipartUpload', objectUrl(key, { uploadId }), {
        method: 'DELETE',
      })
    },
    presignDownload(key) {
      return presign('GET', key)
    },
  }
}
