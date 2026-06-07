import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { updateChromaStatus } from './status'
import { createLogger } from '../../utils/logger'
import { getChromaDataDir, getLogsDir } from '../../utils/paths'

const logger = createLogger('chroma-server')

let chromaProc: ReturnType<typeof Bun.spawn> | null = null
let chromaPort: number | null = null
let stopping = false
let onUnexpectedExit: (() => void) | null = null

export function getChromaPort(): number | null {
  return chromaPort
}

/**
 * Registers a callback invoked when the Chroma child dies unexpectedly
 * (bootstrap uses it to restart with backoff — kept as a callback to avoid
 * an import cycle with the sync layer).
 */
export function setChromaUnexpectedExitHandler(fn: () => void): void {
  onUnexpectedExit = fn
}

/**
 * Finds a free TCP port by binding port 0 on loopback and reading the
 * kernel-assigned port back.
 */
function pickFreePort(): number {
  const listener = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: { data() {} },
  })
  const port = listener.port
  listener.stop(true)
  return port
}

function getPidFilePath(): string {
  return join(getChromaDataDir(), 'chroma-server.pid')
}

/**
 * Returns true when the given PID is alive AND is one of our --chroma-server
 * children (command-line check guards against PID reuse after reboots).
 */
function isChromaServerProcess(pid: number): boolean {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
        ],
        { stdio: 'pipe', timeout: 5_000 },
      ).toString()
      return out.includes('--chroma-server')
    }
    const out = execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
      stdio: 'pipe',
      timeout: 5_000,
    }).toString()
    return out.includes('--chroma-server')
  } catch {
    return false
  }
}

/**
 * Kills a stale Chroma child left behind by a previous run (crash, SIGKILL,
 * dev watcher restart). Two Chroma servers on the same persistence dir would
 * corrupt it, so this runs before every spawn.
 */
function killStaleChromaServer(): void {
  const pidFile = getPidFilePath()
  try {
    if (!existsSync(pidFile)) return
    const stalePid = Number(readFileSync(pidFile, 'utf8').trim())
    if (
      Number.isFinite(stalePid) &&
      stalePid > 0 &&
      stalePid !== process.pid &&
      isChromaServerProcess(stalePid)
    ) {
      logger.warning(`Killing stale Chroma server (pid ${stalePid})`)
      process.kill(stalePid)
    }
  } catch {
    // best-effort — process already gone
  }
  try {
    rmSync(pidFile, { force: true })
  } catch {
    // ignore
  }
}

/**
 * Builds the argv to re-invoke ourselves with --chroma-server.
 * Dev: `bun src/index.ts --chroma-server ...` (Bun.main exists on disk).
 * Compiled standalone: `<sidecar> --chroma-server ...` (Bun.main is a
 * virtual bunfs path; the binary ignores script-path args).
 */
function buildSelfSpawnArgs(extraArgs: string[]): string[] {
  const isCompiled = !existsSync(Bun.main)
  if (isCompiled) {
    return [process.execPath, ...extraArgs]
  }
  return [process.execPath, Bun.main, ...extraArgs]
}

/**
 * Spawns the Chroma server as a child process (ourselves re-invoked with
 * --chroma-server, mirroring the --probe-midi pattern) and waits for its
 * /api/v2/heartbeat to answer. Returns the port it listens on.
 */
export async function startChromaServer(): Promise<number> {
  if (chromaProc && chromaPort) return chromaPort

  stopping = false
  const dataDir = getChromaDataDir()
  mkdirSync(dataDir, { recursive: true })
  killStaleChromaServer()

  const port = Number(process.env.CHROMA_PORT) || pickFreePort()
  const logsDir = getLogsDir()
  mkdirSync(logsDir, { recursive: true })
  const logPath = join(logsDir, 'chroma.log')

  logger.info(`Starting Chroma server on port ${port} (data: ${dataDir})`)
  updateChromaStatus({ state: 'starting', port })

  const cmd = buildSelfSpawnArgs([
    '--chroma-server',
    '--chroma-path',
    dataDir,
    '--chroma-port',
    String(port),
  ])

  // Chroma's Rust server is very chatty — keep its output out of the main
  // console and in its own log file for post-mortems.
  const logFile = Bun.file(logPath)
  chromaProc = Bun.spawn(cmd, {
    stdout: logFile,
    stderr: logFile,
    env: { ...process.env, CHROMA_CHILD: 'true' },
  })
  chromaPort = port
  // Persist the child PID so the next boot can reap it if we die without
  // running our shutdown handlers (SIGKILL, dev-watcher restart).
  writeFileSync(getPidFilePath(), String(chromaProc.pid))

  void chromaProc.exited.then((code) => {
    const wasStopping = stopping
    chromaProc = null
    chromaPort = null
    if (!wasStopping) {
      logger.error(`Chroma server exited unexpectedly with code ${code}`)
      updateChromaStatus({
        state: 'error',
        lastError: `Chroma server exited with code ${code} (see logs/chroma.log)`,
      })
      onUnexpectedExit?.()
    }
  })

  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (!chromaProc) {
      throw new Error('Chroma server process died during startup')
    }
    try {
      const res = await fetch(`http://localhost:${port}/api/v2/heartbeat`, {
        signal: AbortSignal.timeout(1_000),
      })
      if (res.ok) {
        logger.info(`Chroma server ready on port ${port}`)
        return port
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('Chroma server did not become ready within 30s')
}

/**
 * Stops the Chroma server child process (graceful SIGTERM, then SIGKILL).
 */
export async function stopChromaServer(): Promise<void> {
  if (!chromaProc) return
  stopping = true
  logger.info('Stopping Chroma server')
  const proc = chromaProc
  proc.kill()
  const killTimer = setTimeout(() => proc.kill(9), 3_000)
  await proc.exited
  clearTimeout(killTimer)
  chromaProc = null
  chromaPort = null
  try {
    rmSync(getPidFilePath(), { force: true })
  } catch {
    // ignore
  }
  updateChromaStatus({ state: 'stopped', port: null })
}
