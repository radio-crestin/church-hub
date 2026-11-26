import { createHash } from 'node:crypto'

const etagOf = (bytes: Uint8Array) =>
  `"${createHash('sha1').update(bytes).digest('hex')}"`

interface Upload {
  key: string
  parts: Map<number, Uint8Array>
}

/**
 * An S3 stand-in for backup tests, in memory: objects with conditional
 * writes, ListObjectsV2, multipart uploads (create, upload part, list
 * parts, complete, abort) and presigned requests (signatures not checked;
 * the presigned query is kept so a test can read X-Amz-Expires).
 */
export class MemoryS3 {
  readonly objects = new Map<string, Uint8Array>()
  readonly uploads = new Map<string, Upload>()
  /** Every request, as "METHOD /bucket/key?query". */
  readonly requests: string[] = []
  /** Answer every request with this status (a failing store). */
  failWith: number | null = null
  private nextUpload = 1

  /** Keys of the stored objects, without the bucket. */
  keys(): string[] {
    return [...this.objects.keys()].map((key) => key.replace(/^[^/]+\//, ''))
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
      .slice(1)
      .split('/')
      .map(decodeURIComponent)
      .join('/')
    const query = url.searchParams
    this.requests.push(`${request.method} /${path}${url.search}`)
    if (this.failWith) {
      return new Response(
        `<Error><Code>InternalError</Code><Key>${path}</Key></Error>`,
        { status: this.failWith }
      )
    }
    const bytes = new Uint8Array(await request.arrayBuffer())

    if (request.method === 'GET' && query.has('list-type')) {
      const bucket = path.split('/')[0]
      const prefix = `${bucket}/${query.get('prefix') ?? ''}`
      const keys = [...this.objects.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => `<Contents><Key>${key.slice(bucket.length + 1)}</Key></Contents>`)
      return new Response(
        `<ListBucketResult><IsTruncated>false</IsTruncated>${keys.join('')}</ListBucketResult>`
      )
    }
    if (request.method === 'POST' && query.has('uploads')) {
      const uploadId = `upload-${this.nextUpload++}`
      this.uploads.set(uploadId, { key: path, parts: new Map() })
      return new Response(
        `<InitiateMultipartUploadResult><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`
      )
    }
    const uploadId = query.get('uploadId')
    if (uploadId) {
      const upload = this.uploads.get(uploadId)
      if (!upload || upload.key !== path) {
        return new Response('<Error><Code>NoSuchUpload</Code></Error>', { status: 404 })
      }
      if (request.method === 'PUT') {
        upload.parts.set(Number(query.get('partNumber')), bytes)
        return new Response(null, { headers: { ETag: etagOf(bytes) } })
      }
      if (request.method === 'GET') {
        const parts = [...upload.parts]
          .sort(([a], [b]) => a - b)
          .map(
            ([n, part]) =>
              `<Part><PartNumber>${n}</PartNumber><ETag>${etagOf(part).replace(/"/g, '&quot;')}</ETag><Size>${part.length}</Size></Part>`
          )
        return new Response(`<ListPartsResult>${parts.join('')}</ListPartsResult>`)
      }
      if (request.method === 'POST') {
        const numbers = [
          ...new TextDecoder().decode(bytes).matchAll(/<PartNumber>(\d+)<\/PartNumber>/g),
        ].map((match) => Number(match[1]))
        const chunks = numbers.map((n) => upload.parts.get(n) ?? new Uint8Array())
        const whole = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0))
        let offset = 0
        for (const chunk of chunks) {
          whole.set(chunk, offset)
          offset += chunk.length
        }
        this.objects.set(path, whole)
        this.uploads.delete(uploadId)
        return new Response('<CompleteMultipartUploadResult/>')
      }
      if (request.method === 'DELETE') {
        this.uploads.delete(uploadId)
        return new Response(null, { status: 204 })
      }
    }
    if (request.method === 'PUT') {
      const existing = this.objects.get(path)
      const ifMatch = request.headers.get('If-Match')
      const ifNoneMatch = request.headers.get('If-None-Match')
      if (
        (ifMatch && (!existing || etagOf(existing) !== ifMatch)) ||
        (ifNoneMatch === '*' && existing)
      ) {
        return new Response(null, { status: 412 })
      }
      this.objects.set(path, bytes)
      return new Response(null, { headers: { ETag: etagOf(bytes) } })
    }
    if (request.method === 'DELETE') {
      this.objects.delete(path)
      return new Response(null, { status: 204 })
    }
    const found = this.objects.get(path)
    if (!found) return new Response(null, { status: 404 })
    const headers = { ETag: etagOf(found), 'Content-Length': String(found.length) }
    return request.method === 'HEAD'
      ? new Response(null, { headers })
      : new Response(found, { headers })
  }
}
