import { STATUS_CODES } from 'node:http'

/** A download the server answered with an HTTP error. */
export class DownloadError extends Error {
  /** The HTTP status as the server sent it, e.g. "403 Forbidden". */
  readonly status: string

  constructor(code: number, url: URL) {
    const status = `${code} ${STATUS_CODES[code] ?? ''}`.trim()
    super(`Download failed: ${status} ${url}`)
    this.name = 'DownloadError'
    this.status = status
  }
}
