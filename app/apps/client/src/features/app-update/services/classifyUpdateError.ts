export type UpdateErrorCode =
  | 'network'
  | 'http'
  | 'signature'
  | 'install'
  | 'unknown'

export interface ClassifiedUpdateError {
  code: UpdateErrorCode
  message: string
  /** Worth another attempt without the operator doing anything. */
  retryable: boolean
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

/**
 * Turns whatever the updater plugin threw into a code the UI can explain
 * and a verdict on retrying. The plugin reports failures as the Rust
 * error's text, so the wording is what separates a dropped connection
 * (retried) from a signature that does not match (never retried: the
 * bytes are wrong, not the network).
 */
export function classifyUpdateError(error: unknown): ClassifiedUpdateError {
  const message = errorMessage(error)
  const lower = message.toLowerCase()

  if (lower.includes('signature')) {
    return { code: 'signature', message, retryable: false }
  }

  // "Download request failed with status: 503 Service Unavailable"
  const status = /status:? (\d{3})/.exec(message)
  if (status) {
    const code = Number(status[1])
    return {
      code: 'http',
      message,
      retryable: code >= 500 || code === 429 || code === 408,
    }
  }

  if (
    /network|connect|dns|resolve|timed? ?out|reset|sending request|socket|tls|certificate|unreachable/.test(
      lower,
    )
  ) {
    return { code: 'network', message, retryable: true }
  }

  return { code: 'unknown', message, retryable: false }
}
