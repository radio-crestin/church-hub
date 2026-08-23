import { HttpStatusError } from './HttpStatusError'
import type { UpdateDownloadErrorCode } from './types'

// Codes Node/Bun put on errors raised by the file-system calls we make
// (mkdir, write stream, copy). Anything else that goes wrong while streaming
// is the connection to GitHub.
const FILESYSTEM_CODES = new Set([
  'EACCES',
  'EPERM',
  'ENOENT',
  'EEXIST',
  'ENOSPC',
  'EDQUOT',
  'EROFS',
  'EISDIR',
  'ENOTDIR',
  'ENAMETOOLONG',
  'EMFILE',
  'EBUSY',
  'EIO',
])

/** "ENOSPC: no space left" rather than "ENOSPC: ENOSPC: no space left". */
function withCode(code: string | undefined, message: string): string {
  if (!code || message.startsWith(code)) return message
  return `${code}: ${message}`
}

export interface ClassifiedDownloadError {
  code: UpdateDownloadErrorCode
  message: string
  /** Worth another attempt without the operator doing anything. */
  retryable: boolean
}

/**
 * Turns whatever a failed download threw into a code the UI can explain and a
 * verdict on whether retrying on its own makes sense. A flaky connection or a
 * 5xx from GitHub's CDN is retried; a folder that cannot be written to, or a
 * 404 because the asset is gone, is reported straight away.
 */
export function classifyDownloadError(error: unknown): ClassifiedDownloadError {
  if (error instanceof HttpStatusError) {
    const retryable =
      error.status >= 500 || error.status === 429 || error.status === 408
    return { code: 'http', message: error.message, retryable }
  }

  if (!(error instanceof Error)) {
    return { code: 'unknown', message: String(error), retryable: false }
  }

  const { code, syscall } = error as Error & {
    code?: unknown
    syscall?: unknown
  }
  const errorCode = typeof code === 'string' ? code : undefined
  // File-system errors name the call that failed (mkdir, open, write);
  // Bun's socket errors carry a code and the URL, never a syscall.
  if (
    (errorCode && FILESYSTEM_CODES.has(errorCode)) ||
    typeof syscall === 'string'
  ) {
    return {
      code: 'filesystem',
      message: withCode(errorCode, error.message),
      retryable: false,
    }
  }

  // Bun reports socket/DNS/TLS problems with its own codes (ConnectionRefused,
  // FailedToOpenSocket, ...) or as a bare "fetch() failed" — all of them are
  // the network, and the `cause`, when present, names the real reason.
  const cause = error.cause instanceof Error ? error.cause.message : null
  const detail = cause && cause !== error.message ? ` (${cause})` : ''
  return {
    code: 'network',
    message: `${withCode(errorCode, error.message)}${detail}`,
    retryable: true,
  }
}
