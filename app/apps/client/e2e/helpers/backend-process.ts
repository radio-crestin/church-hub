import { spawn } from 'node:child_process'

import { BACKEND_DIR, installBackendDependencies } from './backend-dependencies'

const BOOT_TIMEOUT_MS = 60_000

export interface BackendProcess {
  /** Everything the process printed so far. */
  log: () => string
  stop: () => Promise<void>
}

/**
 * Runs a churchhub-backend script on Bun, as a church would self-host it;
 * resolves once it prints `readyLine`.
 */
export async function startBackendProcess(
  script: string,
  env: Record<string, string>,
  readyLine: RegExp,
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
      if (readyLine.test(output)) {
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
