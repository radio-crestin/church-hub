/**
 * X32/XR18 mixer emulator helper for integration testing.
 * Starts a real X32 emulator process that speaks OSC protocol,
 * allowing realistic testing of mixer integration.
 */
import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import dgram from 'node:dgram'
import fs from 'node:fs'
import path from 'node:path'

const EMULATOR_PATH = path.resolve(
  import.meta.dir,
  '../../../../../tools/x32-emulator',
)
const EMULATOR_PORT = 10023

/** Check if the emulator binary exists and is executable on this platform */
export function isEmulatorAvailable(): boolean {
  try {
    fs.accessSync(EMULATOR_PATH, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

let emulatorProcess: ChildProcess | null = null
let startPromise: Promise<void> | null = null
let resolvedIp = '127.0.0.1'

function detectBoundIp(pid: number): string {
  try {
    const output = execFileSync('lsof', ['-nP', '-p', String(pid), '-iUDP'], {
      encoding: 'utf-8',
      timeout: 3000,
    })
    for (const line of output.split('\n')) {
      const match = line.match(/UDP\s+([\d.*]+):10023/)
      if (match) {
        const ip = match[1]
        return ip === '*' ? '127.0.0.1' : ip
      }
    }
  } catch {
    /* ignore */
  }
  return '127.0.0.1'
}

function writeOscString(str: string): Buffer {
  const strBuf = Buffer.from(`${str}\0`, 'ascii')
  const padded = Buffer.alloc(strBuf.length + ((4 - (strBuf.length % 4)) % 4))
  strBuf.copy(padded)
  return padded
}

function encodeOscMsg(address: string): Buffer {
  return Buffer.concat([writeOscString(address), writeOscString(',')])
}

async function probeReady(ip: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now()
  const sock = dgram.createSocket('udp4')
  let closed = false

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      closed = true
      sock.close()
      reject(new Error(`Emulator did not respond (${ip}:${EMULATOR_PORT})`))
    }, timeoutMs)

    sock.on('message', () => {
      clearTimeout(timer)
      closed = true
      sock.close()
      resolve()
    })

    sock.bind(0, ip, () => {
      const tryProbe = () => {
        if (closed || Date.now() - start > timeoutMs) return
        const msg = encodeOscMsg('/info')
        sock.send(msg, 0, msg.length, EMULATOR_PORT, ip)
        setTimeout(tryProbe, 300)
      }
      tryProbe()
    })
  })
}

export async function startEmulator(): Promise<void> {
  if (emulatorProcess && !emulatorProcess.killed) {
    if (startPromise) await startPromise
    return
  }
  if (startPromise) {
    await startPromise
    return
  }

  // Kill any stale emulators on port 10023
  try {
    execFileSync('pkill', ['-f', 'x32-emulator'], { timeout: 2000 })
  } catch {
    /* ok */
  }
  await new Promise((r) => setTimeout(r, 300))

  startPromise = (async () => {
    emulatorProcess = spawn(EMULATOR_PATH, [], {
      stdio: 'ignore',
      detached: false,
    })

    emulatorProcess.on('error', (err) => {
      emulatorProcess = null
      startPromise = null
    })
    emulatorProcess.on('exit', () => {
      emulatorProcess = null
      startPromise = null
    })

    await new Promise((r) => setTimeout(r, 800))
    if (!emulatorProcess?.pid) throw new Error('Emulator failed to start')

    resolvedIp = detectBoundIp(emulatorProcess.pid)
    await probeReady(resolvedIp)
  })()

  await startPromise
}

export function stopEmulator(): void {
  if (emulatorProcess && !emulatorProcess.killed) {
    emulatorProcess.kill('SIGTERM')
    emulatorProcess = null
  }
  startPromise = null
}

process.on('exit', stopEmulator)

export async function ensureEmulator(): Promise<void> {
  await startEmulator()
}

export const EMULATOR_CONFIG = {
  get ip() {
    return resolvedIp
  },
  port: EMULATOR_PORT,
}
