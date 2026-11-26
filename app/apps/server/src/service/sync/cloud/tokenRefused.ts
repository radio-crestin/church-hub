type Listener = () => void

let listener: Listener | null = null

/**
 * Who hears that the sync service refused this server's token (401: the
 * church revoked it). The browser server (T-175) drops the church on it at
 * once; the PC keeps the error on its sync status.
 */
export function onTokenRefused(next: Listener | null): void {
  listener = next
}

export function reportTokenRefused(): void {
  listener?.()
}
