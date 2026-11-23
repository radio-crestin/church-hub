// biome-ignore-all lint/suspicious/noConsole: a command-line script reports on stdout
/**
 * Serves the built spike page, the snapshots, and collects each device's
 * results (POST ./results), under SPIKE_BASE (a preview's base path):
 *   SPIKE_BASE=/x/ bun spikes/cloud-sync/scripts/serve.ts <port> <dist> <snapshots> <results>
 */
import { mkdirSync } from 'node:fs'
import { join, normalize } from 'node:path'

const [port, dist, snapshots, resultsDir] = process.argv.slice(2)
if (!port || !dist || !snapshots || !resultsDir) {
  throw new Error('usage: serve.ts <port> <dist> <snapshots> <results>')
}
const base = process.env.SPIKE_BASE ?? '/'
mkdirSync(resultsDir, { recursive: true })

function fileUnder(root: string, path: string): string | null {
  const full = normalize(join(root, path))
  return full.startsWith(normalize(root)) ? full : null
}

Bun.serve({
  port: Number(port),
  hostname: '127.0.0.1',
  async fetch(request) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith(base))
      return new Response('not found', { status: 404 })
    const path = url.pathname.slice(base.length)

    if (path === 'results' && request.method === 'POST') {
      const results = (await request.json()) as Record<string, unknown>
      const name = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      await Bun.write(join(resultsDir, name), JSON.stringify(results, null, 2))
      console.log(
        `results: ${name} ${String(results.label)} ${String(results.userAgent)}`,
      )
      return Response.json({ saved: name })
    }

    const [root, rest] = path.startsWith('snapshots/')
      ? [snapshots, path.slice('snapshots/'.length)]
      : [dist, path || 'index.html']
    const target = fileUnder(root, rest)
    const file = target ? Bun.file(target) : null
    if (!file || !(await file.exists()))
      return new Response('not found', { status: 404 })
    return new Response(file, {
      headers: {
        'cache-control': 'no-store',
        ...(rest.endsWith('.wasm')
          ? { 'content-type': 'application/wasm' }
          : {}),
        ...(rest.endsWith('.gz') ? { 'content-type': 'application/gzip' } : {}),
      },
    })
  },
})
console.log(`spike on http://127.0.0.1:${port}${base}`)
