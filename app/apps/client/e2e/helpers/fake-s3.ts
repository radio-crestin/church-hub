import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * A tiny S3 stand-in for specs: path-style PUT, GET and DELETE of objects
 * in memory, signatures not checked. GET is open, like a public bucket, so
 * the same server is both the S3 endpoint and the public URL.
 */
export class FakeS3 {
  readonly objects = new Map<string, Buffer>()
  /** Every request, as "METHOD /path", so a spec can see what was sent. */
  readonly requests: string[] = []
  /** Paths answered with a redirect to the given location. */
  readonly redirects = new Map<string, string>()
  private server: Server | undefined

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0])
      this.requests.push(`${req.method} ${path}`)
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
      const location = this.redirects.get(path)
      if (location) {
        res.writeHead(302, { Location: location }).end()
        return
      }
      const body = this.objects.get(path)
      if (!body) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, { 'Content-Length': body.length }).end(body)
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
    await new Promise<void>((resolve) => this.server?.close(() => resolve()))
  }
}
