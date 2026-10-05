import { type BootHealth, getBootHealth, onBootHealthChange } from './bootState'
import { logToFile } from './fileLogger'

/** The boot state as the boot server answers it; it adds `elapsedMs` itself. */
type PublishedHealth = Omit<BootHealth, 'elapsedMs'> & {
  startedAtEpochMs: number
}

type BootServerMessage =
  | { type: 'health'; health: PublishedHealth }
  | { type: 'stop' }

/**
 * The boot server's answer to one request: `/ping` and `/health` answer, the
 * rest get a 503 with the boot state. Self-contained (no outer names): it runs
 * inside the worker as source text.
 */
function bootServerResponse(
  req: Request,
  published: PublishedHealth,
): Response {
  const cors = { 'Access-Control-Allow-Origin': '*' }
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
  return new Response(JSON.stringify({ error: 'Server starting', ...health }), {
    status: 503,
    headers: { ...json, 'Retry-After': '1' },
  })
}

/**
 * The worker's body. Self-contained like `bootServerResponse`, which it gets
 * as an argument: both are passed to the worker as source text.
 */
function bootServerWorkerMain(
  port: number,
  initial: PublishedHealth,
  respond: typeof bootServerResponse,
): void {
  let health = initial
  const server = Bun.serve({
    port,
    hostname: '0.0.0.0',
    reusePort: true,
    fetch: (req) => respond(req, health),
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
  const source = `(${bootServerWorkerMain.toString()})(${port}, ${JSON.stringify(
    publishedHealth(),
  )}, ${bootServerResponse.toString()})`
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
      await stopped
      worker.terminate()
      URL.revokeObjectURL(url)
    },
  }
}

/** Fallback: the same server on the main thread (answers between steps only). */
function startBootServerInline(port: number): BootServer {
  const server = Bun.serve({
    port,
    hostname: '0.0.0.0',
    reusePort: true,
    fetch: (req) => bootServerResponse(req, publishedHealth()),
  })
  return { stop: () => server.stop(true) }
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
    // biome-ignore lint/suspicious/noConsole: startup logging
    console.error(`[startup] ${message}; boot server runs on the main thread`)
    logToFile('boot', 'warn', `boot server worker failed: ${message}`)
    return startBootServerInline(port)
  }
}
