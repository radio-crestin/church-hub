/**
 * Cross-platform script to free one or more ports before dev server starts.
 * Handles ghost PIDs (process gone but port still bound) by retrying.
 *
 * Usage: node scripts/free-port.js <port> [port...]
 */
const { execFileSync } = require('node:child_process')
const net = require('node:net')

const ports = process.argv.slice(2).map((arg) => parseInt(arg, 10))
if (!ports.length || ports.some((p) => !p || Number.isNaN(p))) {
  console.error('[free-port] Usage: node scripts/free-port.js <port> [port...]')
  process.exit(1)
}

const MAX_RETRIES = 6
const RETRY_DELAY_MS = 500

function canBind(p, host) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    if (host) server.listen(p, host)
    else server.listen(p)
  })
}

function findListenerPidsUnix(p) {
  try {
    // -sTCP:LISTEN: only match listeners, never clients merely connected to
    // the port (e.g. a browser with a tab open on localhost:3000).
    const out = execFileSync('lsof', ['-t', `-iTCP:${p}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    }).trim()
    return out ? out.split('\n') : []
  } catch {
    // lsof exits non-zero when nothing matches
    return []
  }
}

async function isPortInUse(p) {
  // Bind probes lie on macOS: SO_REUSEADDR lets a probe bind 127.0.0.1 (or
  // even the wildcard) while another process listens on *:port, falsely
  // reporting the port as free. On unix, ask lsof for actual listeners.
  if (process.platform !== 'win32' && findListenerPidsUnix(p).length > 0) {
    return true
  }
  return !(await canBind(p)) || !(await canBind(p, '127.0.0.1'))
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
      console.log(
        `[free-port] Ghost PIDs on port ${p} — waiting for OS to release`,
      )
    }

    return killed
  } catch {
    return false
  }
}

function findAndKillUnix(p) {
  const pids = findListenerPidsUnix(p)
  if (!pids.length) return false

  for (const pid of pids) {
    console.log(`[free-port] Killing PID ${pid} on port ${p}`)
    try {
      execFileSync('kill', ['-9', pid], { stdio: 'ignore' })
    } catch {
      // Process may have exited between lookup and kill
    }
  }
  return true
}

function tryKillPort(p) {
  return process.platform === 'win32'
    ? findAndKillWindows(p)
    : findAndKillUnix(p)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function freePort(port) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (!(await isPortInUse(port))) {
      console.log(`[free-port] Port ${port} is free`)
      return
    }

    console.log(
      `[free-port] Port ${port} in use, attempt ${attempt}/${MAX_RETRIES}`,
    )

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

async function main() {
  for (const port of ports) {
    await freePort(port)
  }
}

main()
