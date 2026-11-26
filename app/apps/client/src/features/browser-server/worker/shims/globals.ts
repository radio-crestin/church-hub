import { Buffer } from 'buffer'

/**
 * The globals the server's modules read when they load or run, in the
 * browser build: `process` (env, platform), Node's `Buffer` (some modules
 * make one as they load) and the part of `Bun` the shared code calls.
 * Imported first by the worker, before any server module.
 */
const scope = globalThis as unknown as Record<string, unknown>

scope.process ??= {
  // The database is opened by the worker (connection.ts); the server still
  // names a path for it (its id, its folder).
  env: { NODE_ENV: 'production', DATABASE_PATH: '/app.db' },
  platform: 'browser',
  versions: {},
  argv: [],
  pid: 0,
  cwd: () => '/',
  on: () => undefined,
  nextTick: (fn: () => void) => queueMicrotask(fn),
}

scope.Buffer ??= Buffer

const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const MASK_64 = 0xffffffffffffffffn

/**
 * A stable 64-bit hash (FNV-1a), standing in for Bun.hash (wyhash): its
 * values only have to match within this browser's own database.
 */
function hash(input: string | Uint8Array): bigint {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input
  let value = FNV_OFFSET
  for (const byte of bytes)
    value = ((value ^ BigInt(byte)) * FNV_PRIME) & MASK_64
  return value
}

const notInBrowser = (name: string) => () => {
  throw new Error(`${name} needs the church PC`)
}

scope.Bun ??= {
  hash,
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  password: {
    hash: notInBrowser('Bun.password.hash'),
    verify: notInBrowser('Bun.password.verify'),
  },
}
