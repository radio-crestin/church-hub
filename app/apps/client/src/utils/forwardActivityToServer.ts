/**
 * Forward client-side USER ACTIVITY (navigation, login/logout, key actions) to
 * the server so it lands in the on-disk log (`server-YYYY-MM-DD.log`, category
 * `activity`). This gives an audit trail of what the operator did leading up to
 * an error — the browser can't write to disk itself.
 *
 * Kept in a SEPARATE queue from error forwarding so chatty navigation events
 * can never starve the error reporter's per-session budget. Fire-and-forget
 * with light batching; failures are swallowed (never report a reporting
 * failure — it would loop).
 */
import { getApiUrl } from '~/config'

export interface ClientActivityPayload {
  action: string
  message?: string
  source?: string
  context?: Record<string, unknown>
}

const queue: ClientActivityPayload[] = []
const MAX_QUEUE = 100
// Generous per-session cap — activity is higher-volume than errors, but still
// bounded so a runaway loop can't post forever.
const MAX_PER_SESSION = 5000
let sentThisSession = 0
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  flushTimer = null
  if (queue.length === 0) return

  const apiUrl = getApiUrl()
  if (!apiUrl) {
    // No server to forward to (e.g. mobile without a configured URL). Drop the
    // batch rather than grow unbounded.
    queue.length = 0
    return
  }

  const batch = queue.splice(0, MAX_QUEUE)
  sentThisSession += batch.length

  // keepalive so events logged during unload (e.g. a logout navigation) still
  // get sent.
  void fetch(`${apiUrl}/api/client-activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: batch }),
    keepalive: true,
  }).catch(() => {
    // Swallow — never report a reporting failure (would loop).
  })
}

/**
 * Queue a client activity event for forwarding to the server log. Debounced
 * ~1s so bursts coalesce into one request.
 */
export function forwardActivityToServer(payload: ClientActivityPayload): void {
  if (sentThisSession >= MAX_PER_SESSION) return
  if (queue.length >= MAX_QUEUE) queue.shift()
  queue.push(payload)

  if (flushTimer === null) {
    flushTimer = setTimeout(flush, 1000)
  }
}
