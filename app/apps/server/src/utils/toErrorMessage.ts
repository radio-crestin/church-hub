/**
 * The message of a caught error, safe to send in an HTTP response.
 *
 * Only `Error.message` is used: `String(error)` of an arbitrary thrown value
 * can carry a stack trace or internals (CodeQL js/stack-trace-exposure).
 * Log the full error server-side; send this to the client.
 */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}
