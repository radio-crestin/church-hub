/**
 * Writes the nginx security headers of the public web app: a CSP that allows
 * index.html's inline scripts by their sha256 hashes only (no 'unsafe-inline'
 * for scripts). Run at image build time, after `bun run build:public`:
 *
 *   bun deploy/writeSecurityHeaders.ts dist-public/index.html <out.conf>
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [htmlPath, outPath] = process.argv.slice(2)
if (!htmlPath || !outPath) {
  throw new Error('usage: writeSecurityHeaders.ts <index.html> <out.conf>')
}

const html = readFileSync(htmlPath, 'utf8')
const inlineScripts = [
  ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
]
  .map((match) => match[1])
  .filter((body) => body.trim() !== '')
const hashes = inlineScripts.map(
  (body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
)

// connect-src https: a join link may name a self-hosted sync service and its
// bucket, so the hosts are not known at build time.
const csp = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const headers = {
  'Content-Security-Policy': csp,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
}
writeFileSync(
  outPath,
  Object.entries(headers)
    .map(([name, value]) => `add_header ${name} "${value}" always;\n`)
    .join(''),
)
process.stdout.write(
  `CSP with ${hashes.length} inline script hash(es): ${csp}\n`,
)
