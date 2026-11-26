import { createServer } from 'node:http'

export interface RecordingBackend {
  url: string
  /** Every request it got, as `METHOD /path`. */
  requests: string[]
  stop: () => Promise<void>
}

/**
 * A stand-in for Church Hub's backend that answers every request with an
 * empty success and remembers it: a spec points a server at it to see which
 * backend each feature calls.
 */
export async function startRecordingBackend(
  port: number,
): Promise<RecordingBackend> {
  const requests: string[] = []
  const server = createServer((req, res) => {
    requests.push(
      `${req.method} ${new URL(req.url ?? '/', 'http://x').pathname}`,
    )
    req.resume()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true, offers: [] }))
  })
  await new Promise<void>((resolve) =>
    server.listen(port, '127.0.0.1', resolve),
  )
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
