import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

const etagOf = (body: Buffer) =>
  `"${createHash('sha1').update(body).digest('hex')}"`

/**
 * A tiny S3 stand-in for specs: path-style PUT, GET, HEAD and DELETE of
 * objects in memory, signatures not checked. GET is open, like a public
 * bucket, so the same server is both the S3 endpoint and the public URL.
 * Like the cloud sync bucket's policy, anonymous listing is refused (a
 * signed one is answered) and ETags are honoured: If-None-Match on GET
 * (304), If-Match and If-None-Match: * on PUT (412), as conditional writes.
 * Multipart uploads (create, upload part, list parts, list uploads, complete, abort) work
 * too, for the cloud backup bucket; presigned query strings are ignored.
 */
export class FakeS3 {
  readonly objects = new Map<string, Buffer>()
  /** Each object's Cache-Control, as its PUT sent it. */
  readonly cacheControl = new Map<string, string>()
  /** Every request, as "METHOD /path", so a spec can see what was sent. */
  readonly requests: string[] = []
  /** Paths answered with a redirect to the given location. */
  readonly redirects = new Map<string, string>()
  /** Paths never answered, like a stalled server. */
  readonly stalled = new Set<string>()
  /** Paths answered only after this many ms, like a slow server. */
  readonly delays = new Map<string, number>()
  /** Paths answered with this HTTP status, like a server refusing them. */
  readonly statuses = new Map<string, number>()
  /** Refuse PUT and DELETE unsigned (anonymous writes): no Authorization header, no presigned query. */
  signedWritesOnly = false
  /** Multipart uploads in progress, by upload id: their key and parts. */
  readonly multipart = new Map<
    string,
    { path: string; parts: Map<number, Buffer> }
  >()
  private nextUploadId = 1
  private server: Server | undefined

  /** Answers a multipart request (`?uploads` or `?uploadId=`); false if not one. */
  private handleMultipart(
    method: string,
    path: string,
    query: URLSearchParams,
    body: Buffer,
    res: import('node:http').ServerResponse,
  ): boolean {
    if (method === 'GET' && query.has('uploads')) {
      const prefix = `${path}/${query.get('prefix') ?? ''}`
      const uploads = [...this.multipart]
        .filter(([, upload]) => upload.path.startsWith(prefix))
        .map(
          ([id, upload]) =>
            `<Upload><Key>${upload.path.slice(path.length + 1)}</Key><UploadId>${id}</UploadId><Initiated>${new Date().toISOString()}</Initiated></Upload>`,
        )
      res
        .writeHead(200, { 'Content-Type': 'application/xml' })
        .end(
          `<ListMultipartUploadsResult><IsTruncated>false</IsTruncated>${uploads.join('')}</ListMultipartUploadsResult>`,
        )
      return true
    }
    if (method === 'POST' && query.has('uploads')) {
      const uploadId = `e2e-upload-${this.nextUploadId++}`
      this.multipart.set(uploadId, { path, parts: new Map() })
      res
        .writeHead(200, { 'Content-Type': 'application/xml' })
        .end(
          `<InitiateMultipartUploadResult><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`,
        )
      return true
    }
    const uploadId = query.get('uploadId')
    if (!uploadId) return false
    const upload = this.multipart.get(uploadId)
    if (!upload || upload.path !== path) {
      res.writeHead(404).end('<Error><Code>NoSuchUpload</Code></Error>')
      return true
    }
    if (method === 'PUT') {
      upload.parts.set(Number(query.get('partNumber')), body)
      res.writeHead(200, { ETag: etagOf(body) }).end()
    } else if (method === 'GET') {
      const parts = [...upload.parts]
        .sort(([a], [b]) => a - b)
        .map(
          ([n, part]) =>
            `<Part><PartNumber>${n}</PartNumber><ETag>${etagOf(part).replace(/"/g, '&quot;')}</ETag><Size>${part.length}</Size></Part>`,
        )
      res
        .writeHead(200, { 'Content-Type': 'application/xml' })
        .end(`<ListPartsResult>${parts.join('')}</ListPartsResult>`)
    } else if (method === 'POST') {
      const numbers = [
        ...body.toString().matchAll(/<PartNumber>(\d+)<\/PartNumber>/g),
      ].map((match) => Number(match[1]))
      this.objects.set(
        path,
        Buffer.concat(
          numbers.map((n) => upload.parts.get(n) ?? Buffer.alloc(0)),
        ),
      )
      this.multipart.delete(uploadId)
      res.writeHead(200).end('<CompleteMultipartUploadResult/>')
    } else if (method === 'DELETE') {
      this.multipart.delete(uploadId)
      res.writeHead(204).end()
    }
    return true
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const [rawPath, query = ''] = (req.url ?? '/').split('?')
      const path = decodeURIComponent(rawPath)
      this.requests.push(`${req.method} ${path}`)
      // A public bucket's CORS rule: the public app reads it from its origin.
      res.setHeader('Access-Control-Allow-Origin', '*')
      if (req.method === 'GET' && /(^|&)list-type=/.test(query)) {
        if (!req.headers.authorization) {
          res.writeHead(403).end()
          return
        }
        const prefix = `${path}/${new URLSearchParams(query).get('prefix') ?? ''}`
        const keys = [...this.objects.keys()]
          .filter((key) => key.startsWith(prefix))
          .map(
            (key) =>
              `<Contents><Key>${key.slice(path.length + 1)}</Key></Contents>`,
          )
        res
          .writeHead(200, { 'Content-Type': 'application/xml' })
          .end(
            `<ListBucketResult><IsTruncated>false</IsTruncated>${keys.join('')}</ListBucketResult>`,
          )
        return
      }
      const search = new URLSearchParams(query)
      if (search.has('uploads') || search.has('uploadId')) {
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => {
          this.handleMultipart(
            req.method ?? 'GET',
            path,
            search,
            Buffer.concat(chunks),
            res,
          )
        })
        return
      }
      const write = req.method === 'PUT' || req.method === 'DELETE'
      // Signed by the Authorization header, or presigned in the query.
      const signed =
        !!req.headers.authorization || search.has('X-Amz-Signature')
      if (write && this.signedWritesOnly && !signed) {
        res.writeHead(403).end()
        return
      }
      if (req.method === 'PUT') {
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => {
          const existing = this.objects.get(path)
          const ifMatch = req.headers['if-match']
          const ifNoneMatch = req.headers['if-none-match']
          if (
            (ifMatch && (!existing || etagOf(existing) !== ifMatch)) ||
            (ifNoneMatch === '*' && existing)
          ) {
            res.writeHead(412).end()
            return
          }
          const body = Buffer.concat(chunks)
          this.objects.set(path, body)
          const cacheControl = req.headers['cache-control']
          if (cacheControl) this.cacheControl.set(path, cacheControl)
          res.writeHead(200, { ETag: etagOf(body) }).end()
        })
        return
      }
      if (req.method === 'DELETE') {
        this.objects.delete(path)
        res.writeHead(204).end()
        return
      }
      if (this.stalled.has(path)) return
      const status = this.statuses.get(path)
      if (status) {
        res.writeHead(status).end()
        return
      }
      const location = this.redirects.get(path)
      if (location) {
        res.writeHead(302, { Location: location }).end()
        return
      }
      const answer = () => {
        const body = this.objects.get(path)
        if (!body) {
          res.writeHead(404).end()
          return
        }
        const etag = etagOf(body)
        if (req.method === 'HEAD') {
          res
            .writeHead(200, { 'Content-Length': body.length, ETag: etag })
            .end()
          return
        }
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304, { ETag: etag }).end()
          return
        }
        res
          .writeHead(200, { 'Content-Length': body.length, ETag: etag })
          .end(body)
      }
      setTimeout(answer, this.delays.get(path) ?? 0)
    })
    await new Promise<void>((resolve) =>
      this.server?.listen(0, '127.0.0.1', resolve),
    )
  }

  get endpoint(): string {
    const { port } = this.server?.address() as AddressInfo
    return `http://127.0.0.1:${port}`
  }

  /** The object at a bucket-relative path, as text. */
  text(path: string): string | undefined {
    return this.objects.get(path)?.toString('utf8')
  }

  async stop(): Promise<void> {
    this.server?.closeAllConnections()
    await new Promise<void>((resolve) => this.server?.close(() => resolve()))
  }
}
