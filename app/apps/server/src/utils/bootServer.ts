import { bootLoadingPage } from './bootLoadingPage'
import { type BootHealth, getBootHealth, onBootHealthChange } from './bootState'
import { parentToWatch } from './exitWithParent'
import { logToFile } from './fileLogger'
import { getListenHost } from './listenHost'

/** The boot state as the boot server answers it; it adds `elapsedMs` itself. */
type PublishedHealth = Omit<BootHealth, 'elapsedMs'> & {
  startedAtEpochMs: number
}

type BootServerMessage =
  | { type: 'health'; health: PublishedHealth }
  | { type: 'stop' }

/**
 * The boot server's answer to one request: `/ping` and `/health` answer, a
 * browser opening a page gets the loading page, the rest get a 503 with the
 * boot state. Self-contained (no outer names): it runs inside the worker as
 * source text.
 */
function bootServerResponse(
  req: Request,
  published: PublishedHealth,
  loadingPage: string,
): Response {
  // CORS for the app's own origins only, as the real server does
  // (middleware/origins), restated here because this runs as source text:
  // the desktop webview polls /health cross-origin while the server boots.
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  const trusted =
    origin !== null &&
    (/^(tauri:\/\/localhost|https?:\/\/tauri\.localhost)$/i.test(origin) ||
      /^https?:\/\/(localhost|127(\.\d{1,3}){3}|\[::1\])(:\d+)?$/i.test(
        origin,
      ) ||
      origin === `http://${host}` ||
      origin === `https://${host}`)
  const cors: Record<string, string> = trusted
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {}
  const json = { 'Content-Type': 'application/json', ...cors }
  const { startedAtEpochMs, ...rest } = published
  const health = { ...rest, elapsedMs: Date.now() - startedAtEpochMs }
  const { pathname } = new URL(req.url)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }
  if (pathname === '/health' || pathname === '/api/health') {
    return new Response(JSON.stringify(health), { headers: json })
  }
  if (pathname === '/ping' || pathname === '/api/ping') {
    return new Response(JSON.stringify({ data: 'pong' }), { headers: json })
  }
  const opensPage =
    req.method === 'GET' &&
    !pathname.startsWith('/api/') &&
    (req.headers.get('accept') ?? '').includes('text/html')
  if (opensPage) {
    return new Response(loadingPage, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '1',
      },
    })
  }
  return new Response(JSON.stringify(health), {
    status: 503,
    headers: { ...json, 'Retry-After': '1' },
  })
}

/**
 * The worker's body. Self-contained like `bootServerResponse`, which it gets
 * as an argument: both are passed to the worker as source text.
 *
 * With a `parentPid` (the desktop shell), it also ends the whole process once
 * the shell is gone: the main thread, busy with synchronous boot work, cannot
 * notice until boot ends, and the port stays held meanwhile (T-149). A hard
 * exit mid-boot is safe: SQLite's journal rolls it back like a crash.
 */
function bootServerWorkerMain(
  port: number,
  hostname: string,
  initial: PublishedHealth,
  loadingPage: string,
  respond: typeof bootServerResponse,
  parentPid: number,
): void {
  if (parentPid) {
    setInterval(() => {
      let gone = process.ppid !== parentPid // POSIX: reparented
      try {
        process.kill(parentPid, 0)
      } catch {
        gone = true
      }
      if (!gone) return
      // biome-ignore lint/suspicious/noConsole: Shutdown reason for the logs
      console.log('[shutdown] The desktop shell is gone during boot: exiting')
      process.kill(process.pid, 'SIGKILL')
    }, 500)
  }
  let health = initial
  const server = Bun.serve({
    port,
    hostname,
    reusePort: true,
    fetch: (req) => respond(req, health, loadingPage),
  })
  self.onmessage = async (event: MessageEvent<BootServerMessage>) => {
    if (event.data.type === 'health') health = event.data.health
    if (event.data.type === 'stop') {
      await server.stop(true)
      postMessage({ type: 'stopped' })
    }
  }
  postMessage({ type: 'listening' })
}

const epochOffsetMs = Date.now() - performance.now()

function publishedHealth(): PublishedHealth {
  const { elapsedMs, ...rest } = getBootHealth()
  return {
    ...rest,
    startedAtEpochMs: Math.round(epochOffsetMs + performance.now() - elapsedMs),
  }
}

export interface BootServer {
  stop(): Promise<void>
}

const WORKER_START_TIMEOUT_MS = 3000

function waitForWorker(worker: Worker, type: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`boot server worker: no "${type}" in time`)),
      WORKER_START_TIMEOUT_MS,
    )
    worker.addEventListener('error', (event) => {
      clearTimeout(timer)
      reject(new Error(`boot server worker: ${event.message}`))
    })
    worker.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type !== type) return
      clearTimeout(timer)
      resolve()
    })
  })
}

/**
 * Runs the boot server in a worker thread. Migrations, seeding and the search
 * index are synchronous SQLite work that blocks the main thread for seconds on
 * a first start; a server on the main thread could not answer meanwhile, so
 * the window's loading page saw nothing. The worker answers at once, and gets
 * each boot state change by message. Built from source text (a blob URL), so
 * dev and the compiled sidecar load it the same way on every OS.
 */
async function startBootServerWorker(port: number): Promise<BootServer> {
  const source = `(${bootServerWorkerMain.toString()})(${port}, ${JSON.stringify(getListenHost())}, ${JSON.stringify(
    publishedHealth(),
  )}, ${JSON.stringify(bootLoadingPage())}, ${bootServerResponse.toString()}, ${parentToWatch()})`
  const url = URL.createObjectURL(
    new Blob([source], { type: 'application/javascript' }),
  )
  const worker = new Worker(url)
  try {
    await waitForWorker(worker, 'listening')
  } catch (error) {
    worker.terminate()
    throw error
  }
  const unsubscribe = onBootHealthChange(() =>
    worker.postMessage({ type: 'health', health: publishedHealth() }),
  )
  return {
    async stop() {
      unsubscribe()
      const stopped = waitForWorker(worker, 'stopped')
      worker.postMessage({ type: 'stop' })
      try {
        await stopped
      } catch (error) {
        // Terminating the worker frees the port too; the real server's bind
        // retries until it is free, so starting up carries on.
        logBootServerProblem(error)
      } finally {
        worker.terminate()
        URL.revokeObjectURL(url)
      }
    },
  }
}

const INLINE_BIND_ATTEMPTS = 10
const INLINE_BIND_RETRY_MS = 300

/**
 * Fallback: the same server on the main thread (answers between steps only).
 * Retries the bind: a worker that timed out may still be letting the port go.
 */
async function startBootServerInline(port: number): Promise<BootServer> {
  const loadingPage = bootLoadingPage()
  for (let attempt = 1; ; attempt++) {
    try {
      const server = Bun.serve({
        port,
        hostname: getListenHost(),
        reusePort: true,
        fetch: (req) => bootServerResponse(req, publishedHealth(), loadingPage),
      })
      return { stop: () => server.stop(true) }
    } catch (error) {
      if (attempt >= INLINE_BIND_ATTEMPTS) throw error
      await Bun.sleep(INLINE_BIND_RETRY_MS)
    }
  }
}

function logBootServerProblem(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  // biome-ignore lint/suspicious/noConsole: startup logging
  console.error(`[startup] ${message}`)
  logToFile('boot', 'warn', message)
}

/**
 * Binds the port before the heavy boot work, so `/ping` and `/health` answer
 * from the first moment: the loading page shows each step and, if one fails,
 * the reason. `stop()` frees the port for the real server.
 */
export async function startBootServer(port: number): Promise<BootServer> {
  try {
    return await startBootServerWorker(port)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logBootServerProblem(`${message}; boot server runs on the main thread`)
    return startBootServerInline(port)
  }
}
