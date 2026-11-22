import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const SERVER_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'server',
)
const GENERATOR = join(SERVER_DIR, 'scripts', 'generate-embedded-migrations.ts')
const MIGRATIONS = join(SERVER_DIR, 'drizzle', 'migrations')
const EMBEDDED = join(SERVER_DIR, 'src', 'db', 'migrations', 'embedded.ts')

/**
 * Compiling the sidecar regenerates embedded.ts from the migrations. A Windows
 * checkout (CRLF) or the generator's own quoting rewrote it, leaving a diff in
 * every worktree that built the app (T-162). It must come out byte-identical.
 */
test.describe('embedded migrations', () => {
  test('are generated exactly as committed, even from CRLF migrations', () => {
    const dir = mkdtempSync(join(tmpdir(), 'embedded-migrations-'))
    try {
      const crlf = join(dir, 'migrations')
      cpSync(MIGRATIONS, crlf, { recursive: true })
      for (const file of readdirSync(crlf).filter((f) => f.endsWith('.sql'))) {
        const sql = readFileSync(join(crlf, file), 'utf8')
        writeFileSync(join(crlf, file), sql.replace(/\r?\n/g, '\r\n'))
      }
      const out = join(dir, 'embedded.ts')

      const run = spawnSync('bun', [GENERATOR, crlf, out], {
        encoding: 'utf8',
        timeout: 30_000,
      })

      expect(run.status, run.stderr).toBe(0)
      expect(readFileSync(out, 'utf8')).toBe(readFileSync(EMBEDDED, 'utf8'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
