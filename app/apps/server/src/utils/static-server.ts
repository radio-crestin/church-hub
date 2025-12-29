import { existsSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

// Vite dev server port - configurable via VITE_DEV_PORT env var
// Default: 8086, but can be changed for worktrees to avoid port conflicts
const VITE_DEV_PORT = process.env['VITE_DEV_PORT'] ?? '8086'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
}

/**
 * Serves static files from the client dist directory
 * Implements SPA fallback - serves index.html for non-file routes
 */
export async function serveStaticFile(
  pathname: string,
  distPath: string,
): Promise<Response | null> {
  // Normalize the pathname
  const safePath = pathname.replace(/\.\./g, '')

  // Try exact file match
  const filePath = join(distPath, safePath)

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath).toLowerCase()
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
    const file = Bun.file(filePath)
    return new Response(file, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control':
          ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
      },
    })
  }

  // SPA fallback: serve index.html for non-file routes
  const indexPath = join(distPath, 'index.html')
  if (existsSync(indexPath)) {
    const file = Bun.file(indexPath)
    return new Response(file, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      },
    })
  }

  return null
}

/**
 * Proxies requests to the Vite dev server in development mode
 * This allows accessing the app via port 3000 in dev, same as production
 */
export async function proxyToVite(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const viteUrl = `http://localhost:${VITE_DEV_PORT}${url.pathname}${url.search}`

  try {
    const proxyReq = new Request(viteUrl, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      redirect: 'manual',
    })

    const response = await fetch(proxyReq)

    // Clone response with modified headers for CORS
    const headers = new Headers(response.headers)

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (_error) {
    // Vite server not running or unreachable
    return new Response(
      `Vite dev server not reachable at localhost:${VITE_DEV_PORT}. Make sure it's running.`,
      { status: 502 },
    )
  }
}
