import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * A tiny S3 stand-in for specs: path-style PUT, GET and DELETE of objects
 * in memory, signatures not checked. GET is open, like a public bucket, so
 * the same server is both the S3 endpoint and the public URL. Like the
 * cloud sync bucket's policy, listing is refused and an object's ETag is
 * honoured (If-None-Match: 304).
 */
export class FakeS3 {
  readonly objects = new Map<string, Buffer>()
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
  /** Refuse PUT and DELETE without an Authorization header (anonymous writes). */
  signedWritesOnly = false
  private server: Server | undefined

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const [rawPath, query = ''] = (req.url ?? '/').split('?')
      const path = decodeURIComponent(rawPath)
      this.requests.push(`${req.method} ${path}`)
      if (req.method === 'GET' && /(^|&)list-type=/.test(query)) {
        res.writeHead(403).end()
        return
      }
      const write = req.method === 'PUT' || req.method === 'DELETE'
      if (write && this.signedWritesOnly && !req.headers.authorization) {
        res.writeHead(403).end()
        return
      }
      if (req.method === 'PUT') {
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => {
          this.objects.set(path, Buffer.concat(chunks))
          res.writeHead(200, { ETag: '"fake"' }).end()
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
        const etag = `"${createHash('sha1').update(body).digest('hex')}"`
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
