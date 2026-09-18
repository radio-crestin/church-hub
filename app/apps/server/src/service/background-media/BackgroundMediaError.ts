/**
 * Expected failure of a background-media operation, carrying the HTTP status
 * the route answers with (400 bad id / empty body, 404 missing, 413 too large,
 * 415 unsupported type).
 */
export class BackgroundMediaError extends Error {
  readonly status: 400 | 404 | 413 | 415

  constructor(status: 400 | 404 | 413 | 415, message: string) {
    super(message)
    this.name = 'BackgroundMediaError'
    this.status = status
  }
}
