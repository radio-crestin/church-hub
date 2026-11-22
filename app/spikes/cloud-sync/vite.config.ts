// biome-ignore-all lint/correctness/noUndeclaredDependencies: the spike sits outside the workspaces and uses app/node_modules
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const NODE_STUB_PREFIX = '\0node-stub:'
const FIXTURE_FILE_PREFIX = '\0fixture-file:'

/** Built-ins with a browser shim of their own; the rest become stubs. */
const SHIMS: Record<string, string> = {
  'bun:sqlite': here('./src/worker/bunSqliteShim.ts'),
  'node:crypto': here('./src/worker/nodeCryptoShim.ts'),
  crypto: here('./src/worker/nodeCryptoShim.ts'),
}

/** The only server files the browser build replaces. */
const SERVER_FILE_SWAPS: Record<string, string> = {
  'db/connection.ts': here('./src/worker/browserConnection.ts'),
  'db/fixtures/readFixtureFile.ts': here('./src/worker/readFixtureFileShim.ts'),
}

/**
 * Runs the server's own modules in the browser: `bun:sqlite` becomes the
 * sqlite-wasm shim, `db/connection.ts` the OPFS connection, the seed fixtures
 * nothing, and every other Node or Bun built-in a stub that records when it
 * is called (the list is part of the spike's report). Everything else is the
 * server's code, unchanged.
 */
function serverInBrowser(): Plugin {
  const stubbed = new Set<string>()
  const serverPath = (path?: string) => path?.split('/apps/server/src/')[1]
  return {
    name: 'server-in-browser',
    enforce: 'pre',
    async resolveId(id, importer, options) {
      if (SHIMS[id]) return SHIMS[id]
      if (
        id === 'bun' ||
        id.startsWith('node:') ||
        NODE_BUILTINS.has(id) ||
        SERVER_ONLY_PACKAGES.has(id)
      ) {
        stubbed.add(`${id} ← ${serverPath(importer) ?? importer}`)
        return NODE_STUB_PREFIX + id
      }
      if (!id.startsWith('.') || !serverPath(importer)) return null
      if (id.endsWith('.json') && options.attributes?.type === 'file') {
        return `${FIXTURE_FILE_PREFIX}${id}.js`
      }
      const resolved = await this.resolve(id, importer, {
        ...options,
        skipSelf: true,
      })
      const swap = SERVER_FILE_SWAPS[serverPath(resolved?.id) ?? '']
      return swap ?? null
    },
    load(id) {
      if (id.startsWith(FIXTURE_FILE_PREFIX)) {
        return `export default ${JSON.stringify(id.slice(FIXTURE_FILE_PREFIX.length, -3))}`
      }
      if (!id.startsWith(NODE_STUB_PREFIX)) return null
      const name = id.slice(NODE_STUB_PREFIX.length)
      return {
        code: `const name = ${JSON.stringify(name)}
const stub = (path) => new Proxy(function () {}, {
  get: (_t, key) => key === Symbol.toPrimitive ? () => path : key === 'then' ? undefined : stub(path + '.' + String(key)),
  apply: () => { (globalThis.__stubCalls ??= new Set()).add(path); return undefined },
  construct: () => { (globalThis.__stubCalls ??= new Set()).add('new ' + path); return {} },
})
export default stub(name)`,
        syntheticNamedExports: 'default',
      }
    },
    buildEnd() {
      // biome-ignore lint/suspicious/noConsole: build report
      console.log(
        `\n[server-in-browser] stubbed imports:\n  ${[...stubbed].sort().join('\n  ')}\n`,
      )
    },
  }
}

/** Server-side packages with no use on a phone (telemetry): stubbed too. */
const SERVER_ONLY_PACKAGES = new Set(['posthog-node'])

const NODE_BUILTINS = new Set([
  'fs',
  'fs/promises',
  'path',
  'os',
  'crypto',
  'stream',
  'util',
  'events',
  'child_process',
  'url',
  'zlib',
  'http',
  'https',
  'net',
  'tls',
  'dns',
  'worker_threads',
  'buffer',
  'module',
  'process',
  'assert',
  'readline',
])

export default defineConfig({
  root: here('.'),
  base: process.env.SPIKE_BASE ?? '/',
  plugins: [serverInBrowser()],
  worker: { format: 'es', plugins: () => [serverInBrowser()] },
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  build: {
    outDir: process.env.SPIKE_OUT ?? here('./dist'),
    emptyOutDir: true,
    target: 'es2022',
    reportCompressedSize: true,
    minify: process.env.SPIKE_MINIFY !== '0',
  },
})
