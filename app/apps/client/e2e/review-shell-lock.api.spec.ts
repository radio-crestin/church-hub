import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

import { LOCK_STALE_MS, withLock } from '../../../scripts/review-shell-lock'

const SCRIPTS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'scripts',
)

/**
 * Task sessions see the main checkout read-only and run in their own pid
 * namespaces (T-217): the review shell's lock lives in a shared cache and
 * must not trust a holder's pid, and `bun install` must not rewrite a
 * read-only .git/config.
 */
test.describe('review build in a task session', () => {
  let dir: string

  test.beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'review-lock-'))
  })

  test.afterEach(() => {
    chmodSync(dir, 0o755)
    rmSync(dir, { recursive: true, force: true })
  })

  test('a lock nobody touched for 2 minutes is taken over, even with a live pid in it', async () => {
    const lock = join(dir, '.review-build.lock')
    mkdirSync(lock)
    writeFileSync(join(lock, 'pid'), String(process.pid))
    const past = new Date(Date.now() - LOCK_STALE_MS - 60_000)
    utimesSync(lock, past, past)

    let ran = false
    await withLock(dir, async () => {
      ran = true
    })

    expect(ran).toBe(true)
    expect(existsSync(lock)).toBe(false)
  })

  test('a lock in use is waited for, then taken', async () => {
    const lock = join(dir, '.review-build.lock')
    mkdirSync(lock)
    let ran = false
    const waiting = withLock(dir, async () => {
      ran = true
    })

    await new Promise((wake) => setTimeout(wake, 1000))
    expect(ran).toBe(false)
    rmSync(lock, { recursive: true })
    await waiting

    expect(ran).toBe(true)
  })

  test('the holder keeps its lock fresh while it builds', async () => {
    test.setTimeout(60_000)
    const lock = join(dir, '.review-build.lock')
    let age = Number.POSITIVE_INFINITY

    await withLock(dir, async () => {
      await new Promise((wake) => setTimeout(wake, 25_000))
      age = Date.now() - statSync(lock).mtimeMs
    })

    expect(age).toBeLessThan(10_000)
  })

  test('bun install leaves a read-only .git/config alone when the hooks are already set', () => {
    const git = (args: string[]) =>
      spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
    git(['init', '-q'])
    git(['config', 'core.hooksPath', '.githooks'])
    chmodSync(join(dir, '.git'), 0o555)

    const run = spawnSync('node', [join(SCRIPTS, 'install-git-hooks.js')], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 30_000,
    })
    chmodSync(join(dir, '.git'), 0o755)

    expect(run.status, run.stderr).toBe(0)
  })
})
