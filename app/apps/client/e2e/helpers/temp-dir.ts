import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** A fresh folder in the OS temp dir; pair it with removeTempDir in a finally. */
export function makeTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

/** Kills the processes and waits until they have exited, so their files unlock. */
export async function killAndWait(children: ChildProcess[]): Promise<void> {
  await Promise.all(
    children.map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null)
            return resolve()
          child.once('exit', () => resolve())
          child.kill('SIGKILL')
        }),
    ),
  )
}

/**
 * Removes a temp folder, retrying while Windows still holds a file in it
 * (a just-killed server's SQLite database), and fails loudly if it cannot.
 */
export function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
}
