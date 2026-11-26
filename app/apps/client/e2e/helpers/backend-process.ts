import { spawn } from 'node:child_process'

import { BACKEND_DIR, installBackendDependencies } from './backend-dependencies'

const BOOT_TIMEOUT_MS = 60_000

export interface BackendProcess {
  /** Everything the process printed so far. */
  log: () => string
  stop: () => Promise<void>
}

interface ReadySignals {
  /** Lines that must all have been printed before the process is ready. */
  ready: RegExp[]
  /** A line that means it never will be. */
  failed?: RegExp
}

/**
 * Runs a churchhub-backend script on Bun, as a church would self-host it;
 * resolves once it has printed every `ready` line.
 */
export async function startBackendProcess(
  script: string,
  env: Record<string, string>,
  { ready, failed }: ReadySignals,
): Promise<BackendProcess> {
  installBackendDependencies()
  const child = spawn(
    process.platform === 'win32' ? 'bun.exe' : 'bun',
    [script],
    {
      cwd: BACKEND_DIR,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let output = ''
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${script} not ready:\n${output}`)),
      BOOT_TIMEOUT_MS,
    )
    const onData = (chunk: Buffer) => {
      output += chunk.toString()
      if (failed?.test(output)) {
        clearTimeout(timer)
        reject(new Error(`${script} refused to start:\n${output}`))
      } else if (ready.every((line) => line.test(output))) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`${script} exited (${code}):\n${output}`))
    })
  })
  return {
    log: () => output,
    stop: async () => {
      if (child.exitCode !== null) return
      const exited = new Promise((resolve) => child.once('exit', resolve))
      child.kill()
      await exited
    },
  }
}
