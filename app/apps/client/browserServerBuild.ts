import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { normalizePath, type Plugin } from 'vite'

/**
 * Builds the server's own modules into the browser-server worker
 * (src/features/browser-server/worker): the web app runs the server's HTTP
 * API on sqlite-wasm when no church PC answers. Only Bun's and Node's
 * built-ins and a few server files are swapped; every route and service is
 * the server's, unchanged (T-175, measured in the T-170 spike).
 */

// Forward slashes on Windows too, or a swapped file is a second module instance.
const here = (path: string) =>
  normalizePath(fileURLToPath(new URL(path, import.meta.url)))

const SHIMS_DIR = './src/features/browser-server/worker/shims/'
const shim = (name: string) => here(`${SHIMS_DIR}${name}`)

/** Built-ins a browser package stands in for. */
const PACKAGE_SHIMS: Record<string, string> = {
  'node:path': 'pathe',
  path: 'pathe',
  'node:buffer': 'buffer',
  buffer: 'buffer',
}

/** Built-ins with a browser version of their own. */
const SHIMS: Record<string, string> = {
  'bun:sqlite': shim('bunSqlite.ts'),
  'node:crypto': shim('nodeCrypto.ts'),
  crypto: shim('nodeCrypto.ts'),
  'node:async_hooks': shim('asyncHooks.ts'),
  async_hooks: shim('asyncHooks.ts'),
}

/** The server files the browser replaces (paths under apps/server/src/). */
const SERVER_FILE_SWAPS: Record<string, string> = {
  'db/connection.ts': shim('connection.ts'),
  'db/fixtures/readFixtureFile.ts': shim('readFixtureFile.ts'),
  'service/sync/cloud/getInstallation.ts': shim('installation.ts'),
  'service/secret-store/sealSecret.ts': shim('sealSecret.ts'),
  'service/secret-store/openSecret.ts': shim('openSecret.ts'),
}

/**
 * Packages for what only the PC does: hardware (MIDI, audio, OBS), Google,
 * AI with the PC's keys, telemetry, the WebRTC answerer, music files.
 */
const SERVER_ONLY_PACKAGES = [
  '@ai-sdk/anthropic',
  '@ai-sdk/google',
  '@ai-sdk/openai',
  '@google/genai',
  'ai',
  'audify',
  'easymidi',
  'google-auth-library',
  'googleapis',
  'music-metadata',
  'obs-websocket-js',
  'posthog-node',
  'ppt-to-text',
  'spessasynth_core',
  'werift',
]

const NODE_BUILTINS = new Set([
  'assert',
  'child_process',
  'dgram',
  'dns',
  'events',
  'fs',
  'fs/promises',
  'http',
  'https',
  'module',
  'net',
  'os',
  'path',
  'process',
  'readline',
  'stream',
  'stream/promises',
  'tls',
  'url',
  'util',
  'worker_threads',
  'zlib',
])

const STUB_PREFIX = '\0server-stub:'
const FIXTURE_PREFIX = '\0fixture-url:'

function isStubbed(id: string): boolean {
  return (
    id === 'bun' ||
    id.startsWith('bun:') ||
    id.startsWith('node:') ||
    NODE_BUILTINS.has(id) ||
    SERVER_ONLY_PACKAGES.some(
      (name) => id === name || id.startsWith(`${name}/`),
    )
  )
}

const serverPath = (path?: string) => path?.split('/apps/server/src/')[1]

/**
 * What a PC-only module is in the browser: a stand-in that answers anything
 * and logs (debug), once per name, when the server calls it. The routes that need
 * the PC are refused before they run (worker/pcOnlyRoutes.ts), so a call
 * reaching one is worth a look.
 */
const stubModule = (name: string) => `const warned = new Set()
const stub = (path) => new Proxy(function () {}, {
  get: (_t, key) => key === Symbol.toPrimitive ? () => path : key === 'then' ? undefined : stub(path + '.' + String(key)),
  apply: () => { if (!warned.has(path)) { warned.add(path); console.debug('[browser-server] PC-only call: ' + path) } },
  construct: () => stub('new ' + path),
})
export default stub(${JSON.stringify(name)})`

export function serverInBrowser(): Plugin {
  let serving = false
  return {
    name: 'church-hub-server-in-browser',
    enforce: 'pre',
    configResolved(config) {
      serving = config.command === 'serve'
    },
    async resolveId(id, importer, options) {
      if (SHIMS[id]) return SHIMS[id]
      if (PACKAGE_SHIMS[id]) {
        return this.resolve(
          PACKAGE_SHIMS[id],
          here('./browserServerBuild.ts'),
          {
            skipSelf: true,
          },
        )
      }
      if (isStubbed(id)) return STUB_PREFIX + id
      if (!id.startsWith('.') || !serverPath(importer)) return null
      const resolved = await this.resolve(id, importer, {
        ...options,
        skipSelf: true,
      })
      if (!resolved) return null
      // Embedded files (`with { type: 'file' }`): the seed fixtures become
      // gzipped assets the guest database is seeded from; others, nothing.
      if (options.attributes?.type === 'file') {
        return `${FIXTURE_PREFIX}${resolved.id}.js`
      }
      return SERVER_FILE_SWAPS[serverPath(resolved.id) ?? ''] ?? null
    },
    load(id) {
      if (id.startsWith(STUB_PREFIX)) {
        return {
          code: stubModule(id.slice(STUB_PREFIX.length)),
          syntheticNamedExports: 'default',
        }
      }
      if (!id.startsWith(FIXTURE_PREFIX)) return null
      // The suffix keeps Vite's JSON plugin off it.
      const path = id.slice(FIXTURE_PREFIX.length, -'.js'.length)
      if (!path.endsWith('.json')) return 'export default null'
      const name = path.split('/').pop() as string
      const url = serving
        ? JSON.stringify(`/@fs${path}`)
        : `import.meta.ROLLUP_FILE_URL_${this.emitFile({
            type: 'asset',
            name: `${name}.gz`,
            source: gzipSync(readFileSync(path), { level: 9 }),
          })}`
      return `import { registerFixture } from ${JSON.stringify(shim('readFixtureFile.ts'))}
export default registerFixture(${JSON.stringify(name)}, ${url})`
    },
  }
}
