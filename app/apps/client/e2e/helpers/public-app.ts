import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PUBLIC_APP_URL, SYNC_SERVICE_PORT } from '../../playwright.config'

const CLIENT_DIR = fileURLToPath(new URL('../..', import.meta.url))
const DIST_DIR = join(CLIENT_DIR, 'dist-public')
const BUILD_TIMEOUT_MS = 300_000

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  // sqlite-wasm compiles it while it downloads only when served as wasm.
  '.wasm': 'application/wasm',
}

/**
 * The public web app (T-168) as Cloudflare Pages serves it: `bun run
 * build:public`, static files, and index.html for any other path (the
 * SPA fallback). Built against the spec's sync service, its default.
 */
export class PublicAppServer {
  readonly url = PUBLIC_APP_URL
  private server: Server | undefined

  private build(): void {
    const result = spawnSync(
      process.platform === 'win32' ? 'bun.exe' : 'bun',
      ['run', 'build:public'],
      {
        cwd: CLIENT_DIR,
        stdio: 'pipe',
        timeout: BUILD_TIMEOUT_MS,
        env: {
          ...process.env,
          VITE_SYNC_SERVICE_URL: `http://127.0.0.1:${SYNC_SERVICE_PORT}`,
        },
      },
    )
    if (result.status !== 0) {
      throw new Error(
        `build:public failed:\n${result.stdout?.toString()}\n${result.stderr?.toString()}`,
      )
    }
  }

  async start(): Promise<void> {
    this.build()
    this.server = createServer(async (req, res) => {
      const path = normalize(decodeURIComponent(req.url ?? '/').split('?')[0])
      // Any path that isn't a file is the app's (the SPA fallback).
      const file = join(DIST_DIR, extname(path) ? path : 'index.html')
      try {
        const body = await readFile(file)
        const type = TYPES[extname(file)] ?? 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': type }).end(body)
      } catch {
        res.writeHead(404).end()
      }
    })
    const { port } = new URL(this.url)
    await new Promise<void>((resolve) =>
      this.server?.listen(Number(port), '127.0.0.1', resolve),
    )
  }

  async stop(): Promise<void> {
    this.server?.closeAllConnections()
    await new Promise<void>((resolve) => this.server?.close(() => resolve()))
  }
}
