/**
 * The lock around a review shell compile (review-shell.ts): one compile at a
 * time in a shared Cargo target dir, across task sessions.
 */

import { mkdirSync, rmSync, statSync, utimesSync } from 'node:fs'
import { join } from 'node:path'

const LOCK_WAIT_MS = 30 * 60 * 1000
const LOCK_POLL_MS = 5000
// The holder touches the lock this often; one untouched for LOCK_STALE_MS is abandoned.
const LOCK_HEARTBEAT_MS = 20_000
export const LOCK_STALE_MS = 2 * 60 * 1000

/** A lock its holder stopped touching: it died, whatever pid it had. */
function isStale(lock: string) {
  try {
    return Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS
  } catch {
    return false // gone meanwhile: the next mkdir takes it
  }
}

/**
 * A lock folder in the Cargo target dir, held only while a shell compiles
 * (worktrees share that target dir). The holder touches it every
 * LOCK_HEARTBEAT_MS; one untouched for LOCK_STALE_MS is taken over. No pid:
 * task sessions run in their own pid namespaces, and a dead holder can
 * linger as a zombie, so a pid proves nothing about the holder.
 */
export async function withLock(targetDir: string, action: () => Promise<void>) {
  const lock = join(targetDir, '.review-build.lock')
  const started = Date.now()
  mkdirSync(targetDir, { recursive: true })
  while (true) {
    try {
      mkdirSync(lock)
      break
    } catch {
      if (isStale(lock)) {
        rmSync(lock, { recursive: true, force: true })
        continue
      }
      if (Date.now() - started > LOCK_WAIT_MS) {
        throw new Error(`another review shell build holds ${lock}`)
      }
      await new Promise((wake) => setTimeout(wake, LOCK_POLL_MS))
    }
  }
  const heartbeat = setInterval(() => {
    const now = new Date()
    utimesSync(lock, now, now)
  }, LOCK_HEARTBEAT_MS)
  const release = () => rmSync(lock, { recursive: true, force: true })
  process.on('exit', release)
  try {
    await action()
  } finally {
    clearInterval(heartbeat)
    // Ours only until now: on exit it may be another build's.
    process.off('exit', release)
    release()
  }
}
