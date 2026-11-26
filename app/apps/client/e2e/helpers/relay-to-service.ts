import { createServer } from 'node:http'

import { FAKE_RELAY_URL } from '../../playwright.config'

/**
 * Serves the test server's signaling relay address (CHURCH_HUB_SIGNALING_URL)
 * with churchhub-backend's own /signal routes: every request is passed on to
 * the running service (`serviceUrl`) as it came, CORS included. Returns the
 * function that stops it.
 */
export async function relayToService(serviceUrl: string): Promise<() => void> {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === 'string' && name !== 'host') headers.set(name, value)
    }
    const response = await fetch(`${serviceUrl}${req.url ?? '/'}`, {
      method: req.method,
      headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    })
    const out: Record<string, string> = {}
    response.headers.forEach((value, name) => {
      if (name !== 'content-encoding' && name !== 'content-length') {
        out[name] = value
      }
    })
    res.writeHead(response.status, out)
    res.end(Buffer.from(await response.arrayBuffer()))
  })
  await new Promise<void>((resolve) =>
    server.listen(Number(new URL(FAKE_RELAY_URL).port), '127.0.0.1', resolve),
  )
  return () => {
    server.closeAllConnections()
    server.close()
  }
}
