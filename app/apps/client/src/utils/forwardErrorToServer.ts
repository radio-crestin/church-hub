/**
 * Forward client errors to the server so they land in the on-disk log
 * (`server-YYYY-MM-DD.log`, category `client`) the user attaches to bug reports.
 * The browser can't write to disk itself, and PostHog (which the browser SDK
 * already feeds) is blocked on /screen/* routes and useless offline — so this
 * closes the "client errors never reach the local log" gap.
 *
 * Fire-and-forget with light batching + throttling so an error storm can't
 * flood the network or the log. Failures here are swallowed on purpose: trying
 * to report a reporting failure would loop.
 */
import { getApiUrl } from '~/config'

export interface ClientErrorPayload {
  message: string
  stack?: string
  level?: 'error' | 'warning'
  source?: string
  context?: Record<string, unknown>
}

const queue: ClientErrorPayload[] = []
const MAX_QUEUE = 50
// Hard per-session cap so a tight error loop can't post forever.
const MAX_PER_SESSION = 500
let sentThisSession = 0
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  flushTimer = null
  if (queue.length === 0) return

  const apiUrl = getApiUrl()
  if (!apiUrl) {
    // No server to forward to (e.g. mobile without a configured URL). Drop the
    // batch rather than grow unbounded — PostHog still has these via the SDK.
    queue.length = 0
    return
  }

  const batch = queue.splice(0, MAX_QUEUE)
  sentThisSession += batch.length

  // Use keepalive so errors logged during unload still get sent.
  void fetch(`${apiUrl}/api/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errors: batch }),
    keepalive: true,
  }).catch(() => {
    // Swallow — never report a reporting failure (would loop).
  })
}

/**
 * Queue a client error for forwarding to the server log. Debounced ~1s so
 * bursts coalesce into one request.
 */
export function forwardErrorToServer(payload: ClientErrorPayload): void {
  if (sentThisSession >= MAX_PER_SESSION) return
  if (queue.length >= MAX_QUEUE) queue.shift()
  queue.push(payload)

  if (flushTimer === null) {
    flushTimer = setTimeout(flush, 1000)
  }
}
