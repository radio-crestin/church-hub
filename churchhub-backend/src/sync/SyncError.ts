import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * A refused /sync request: its HTTP status, a stable `code` clients branch
 * on, and any details (the rejected or conflicting changes).
 */
export class SyncError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message)
    this.name = 'SyncError'
  }
}
