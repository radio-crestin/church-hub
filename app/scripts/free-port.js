/**
 * Cross-platform script to free a port before dev server starts.
 * Handles ghost PIDs (process gone but port still bound) by retrying.
 *
 * Usage: node scripts/free-port.js <port>
 */
const { execFileSync } = require('node:child_process')
const net = require('node:net')

const port = parseInt(process.argv[2], 10)
if (!port || Number.isNaN(port)) {
  console.error('[free-port] Usage: node scripts/free-port.js <port>')
  process.exit(1)
}

const MAX_RETRIES = 6
const RETRY_DELAY_MS = 500

function isPortInUse(p) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(true))
    server.once('listening', () => {
      server.close()
      resolve(false)
    })
    server.listen(p, '127.0.0.1')
  })
}

function findAndKillWindows(p) {
  try {
    const output = execFileSync('netstat', ['-ano'], { encoding: 'utf8' })
    const portStr = `:${p}`
    const lines = output.split('\n').filter((l) => l.includes(portStr))
    if (!lines.length) return false

    // Collect all unique PIDs connected to this port (listeners, CLOSE_WAIT, FIN_WAIT, etc.)
    const pids = new Set()
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && pid !== '0') pids.add(pid)
    }

    let killed = false
    for (const pid of pids) {
      // Check if process actually exists
      try {
        const tasklist = execFileSync(
          'tasklist',
          ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
          { encoding: 'utf8' },
        ).trim()

        if (tasklist.startsWith('INFO:') || !tasklist) {
          continue
        }
      } catch {
        continue
      }

      console.log(`[free-port] Killing PID ${pid} on port ${p}`)
      try {
        execFileSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' })
        killed = true
      } catch {
        // Process may have exited between check and kill
      }
    }

    if (!killed && pids.size > 0) {
      console.log(`[free-port] Ghost PIDs on port ${p} — waiting for OS to release`)
    }

    return killed
  } catch {
    return false
  }
}

function findAndKillUnix(p) {
  try {
    const pids = execFileSync('lsof', ['-ti', `:${p}`], { encoding: 'utf8' }).trim()
    if (!pids) return false

    for (const pid of pids.split('\n')) {
      console.log(`[free-port] Killing PID ${pid} on port ${p}`)
      execFileSync('kill', ['-9', pid], { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}

function tryKillPort(p) {
  return process.platform === 'win32' ? findAndKillWindows(p) : findAndKillUnix(p)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (!(await isPortInUse(port))) {
      console.log(`[free-port] Port ${port} is free`)
      return
    }

    console.log(`[free-port] Port ${port} in use, attempt ${attempt}/${MAX_RETRIES}`)

    tryKillPort(port)

    await sleep(RETRY_DELAY_MS)
  }

  if (await isPortInUse(port)) {
    console.error(
      `[free-port] Port ${port} is still in use after ${MAX_RETRIES} attempts. ` +
        'You may need to restart your computer.',
    )
  }
}

main()
