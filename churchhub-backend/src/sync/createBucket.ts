import { AwsClient } from 'aws4fetch'
import { SyncError } from './SyncError'
import type { Bindings } from '../types'

export interface PutOptions {
  contentType: string
  cacheControl: string
  /** Write only if the object still has this ETag (compare-and-swap). */
  ifMatch?: string
  /** Write only if no object has this key yet. */
  ifNoneMatch?: '*'
}

/** A bucket only this service writes to (with its keys). */
export interface Bucket {
  /** The new object's ETag, or null when a condition failed (412). */
  put(
    key: string,
    body: Uint8Array,
    options: PutOptions
  ): Promise<string | null>
  /** The object and its ETag, or null when it doesn't exist. */
  get(key: string): Promise<{ bytes: ArrayBuffer; etag: string } | null>
  /** The object's ETag, without its body, or null when it doesn't exist. */
  etag(key: string): Promise<string | null>
  /** Every key under `prefix` (listing needs the service's keys). */
  list(prefix: string): Promise<string[]>
  delete(key: string): Promise<void>
  /** Where readers GET `key` from, without credentials. */
  publicUrl(key: string): string
  /**
   * A URL that lets its holder PUT exactly this object (its type, length
   * and cache rule are signed) for `ttlSeconds`, without the service's keys.
   */
  presignPut(key: string, object: PresignedObject, ttlSeconds: number): Promise<string>
}

/** What a presigned PUT must send: the signed headers. */
export interface PresignedObject {
  contentType: string
  contentLength: number
  cacheControl: string
}

/** A conditional write that lost: 412, or 409 while another one is in flight. */
const CONDITION_FAILED = new Set([409, 412])

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** S3's error `<Code>` (e.g. AccessDenied), or `unknown`. */
async function errorCode(response: Response): Promise<string> {
  const body = await response.text().catch(() => '')
  return body.match(/<Code>([A-Za-z0-9.]{1,64})<\/Code>/)?.[1] ?? 'unknown'
}

/**
 * Any S3-compatible bucket with conditional writes (R2, AWS S3, MinIO…),
 * path-style and signed with SigV4, from the S3_* settings: the public
 * bucket readers fetch from, or (`name`) the one holding the churches'
 * encrypted state.
 */
export function createBucket(env: Bindings, name = env.S3_BUCKET): Bucket {
  const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL } =
    env
  if (
    !S3_ENDPOINT ||
    !name ||
    !S3_ACCESS_KEY_ID ||
    !S3_SECRET_ACCESS_KEY ||
    !S3_PUBLIC_URL
  ) {
    throw new SyncError(
      503,
      'not_configured',
      'Cloud sync storage is not configured'
    )
  }
  const client = new AwsClient({
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    service: 's3',
    region: env.S3_REGION || 'auto',
  })
  const bucketUrl = (endpoint: string) => `${endpoint.replace(/\/+$/, '')}/${name}`
  const base = bucketUrl(S3_ENDPOINT)
  const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/')
  const objectUrl = (key: string) => `${base}/${encodeKey(key)}`
  // The address uploaders reach, when the service's own is internal.
  const presignBase = bucketUrl(env.S3_PRESIGN_ENDPOINT || S3_ENDPOINT)

  const send = async (
    url: string,
    init: RequestInit,
    allowed: (status: number) => boolean = () => false
  ): Promise<Response> => {
    const response = await client.fetch(url, init)
    if (response.ok || response.status === 404 || allowed(response.status)) {
      return response
    }
    // The URL, its query and S3's error body name the object key (a church's
    // path secret): the message keeps only the method, status and S3's code.
    const code = await errorCode(response)
    throw new Error(`S3 ${init.method} failed: ${response.status} ${code}`)
  }

  return {
    async put(key, body, options) {
      const response = await send(
        objectUrl(key),
        {
          method: 'PUT',
          body,
          headers: {
            'Content-Type': options.contentType,
            'Cache-Control': options.cacheControl,
            ...(options.ifMatch ? { 'If-Match': options.ifMatch } : {}),
            ...(options.ifNoneMatch
              ? { 'If-None-Match': options.ifNoneMatch }
              : {}),
          },
        },
        (status) => CONDITION_FAILED.has(status)
      )
      if (CONDITION_FAILED.has(response.status)) return null
      return response.headers.get('ETag') ?? ''
    },
    async get(key) {
      const response = await send(objectUrl(key), { method: 'GET' })
      if (response.status === 404) return null
      return {
        bytes: await response.arrayBuffer(),
        etag: response.headers.get('ETag') ?? '',
      }
    },
    async etag(key) {
      const response = await send(objectUrl(key), { method: 'HEAD' })
      return response.status === 404
        ? null
        : (response.headers.get('ETag') ?? '')
    },
    async list(prefix) {
      const keys: string[] = []
      let token: string | undefined
      do {
        const query = new URLSearchParams({ 'list-type': '2', prefix })
        if (token) query.set('continuation-token', token)
        const response = await send(`${base}?${query}`, { method: 'GET' })
        const xml = await response.text()
        for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) {
          keys.push(decodeXml(match[1]))
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
          ? decodeXml(
              xml.match(/<NextContinuationToken>([^<]*)</)?.[1] ?? ''
            ) || undefined
          : undefined
      } while (token)
      return keys
    },
    async delete(key) {
      await send(objectUrl(key), { method: 'DELETE' })
    },
    publicUrl(key) {
      return `${S3_PUBLIC_URL.replace(/\/+$/, '')}/${key}`
    },
    async presignPut(key, object, ttlSeconds) {
      const url = new URL(`${presignBase}/${encodeKey(key)}`)
      url.searchParams.set('X-Amz-Expires', String(ttlSeconds))
      // allHeaders: aws4fetch leaves Content-Length out of the signature
      // otherwise; signed, the store refuses a body of any other length.
      const signed = await client.sign(url.toString(), {
        method: 'PUT',
        headers: {
          'Content-Type': object.contentType,
          'Content-Length': String(object.contentLength),
          'Cache-Control': object.cacheControl,
        },
        aws: { signQuery: true, allHeaders: true },
      })
      return signed.url
    },
  }
}
